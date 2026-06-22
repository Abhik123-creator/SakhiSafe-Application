import asyncio
import json
import logging
import re
import time
from dataclasses import dataclass
from typing import Any

import httpx

from app.clients.nest_internal_client import NestInternalClientError, nest_internal_client
from app.config import settings
from app.core.llm.base import parse_json_object
from app.core.llm.factory import get_llm_client


logger = logging.getLogger("sakhi-ai-service.whatsapp_intake")

FALLBACK_LLM_OUTPUT = {
    "action": "CONTINUE_CONVERSATION",
    "replyToCareSeeker": "I'm sorry, I could not organize that properly just now. You can send one short message about what happened, and I'll help record it safely.",
}

INCIDENT_SAVE_FALLBACK_REPLY = "I received your message. I may need you to repeat this later if it does not save properly."
IMAGE_UPLOAD_SUCCESS_REPLY = "I received the image and attached it to your private case. You can also send a short message explaining what this image is related to."
IMAGE_DRAFT_CREATED_REPLY = "I received the image and started a private case note for it. Can you briefly tell me what this image is related to?"
IMAGE_UPLOAD_FAILURE_REPLY = "I received your image, but I could not attach it properly right now. You may try sending it again."
UNSUPPORTED_MESSAGE_REPLY = "I received your message. Please send text or an image so I can help record it safely."

VALID_ACTIONS = {"CONTINUE_CONVERSATION", "CREATE_OR_UPDATE_INCIDENT", "ESCALATE_TO_HUMAN", "NO_ACTION"}
VALID_CATEGORIES = {
    "DOMESTIC_VIOLENCE",
    "PHYSICAL_ABUSE",
    "EMOTIONAL_ABUSE",
    "SEXUAL_ABUSE",
    "FINANCIAL_ABUSE",
    "STALKING",
    "HARASSMENT",
    "THREAT",
    "OTHER",
    "UNKNOWN",
}
VALID_SEVERITIES = {"LOW", "MEDIUM", "HIGH", "CRITICAL", "UNKNOWN"}
VALID_URGENCIES = {"LOW", "SOON", "URGENT", "IMMEDIATE", "UNKNOWN"}

_RECENT_MESSAGES_BY_SESSION: dict[str, list[dict[str, Any]]] = {}
_ACTIVE_INCIDENT_CACHE_BY_PHONE: dict[str, tuple[float, dict[str, Any] | None]] = {}
ACTIVE_INCIDENT_CACHE_TTL_SECONDS = 20.0


@dataclass(frozen=True)
class WhatsAppInboundMessage:
    phone_number: str
    profile_name: str | None
    text: str
    raw_payload: dict[str, Any]


@dataclass(frozen=True)
class WhatsAppImageMessage:
    phone_number: str
    profile_name: str | None
    media_id: str
    mime_type: str
    caption: str | None
    media_url: str | None
    raw_payload: dict[str, Any]


@dataclass(frozen=True)
class WhatsAppDownloadedMedia:
    image_bytes: bytes
    mime_type: str
    file_name: str


def normalize_phone_number(raw: str) -> str:
    value = (raw or "").strip()
    if not value:
        return ""
    digits = re.sub(r"\D", "", value)
    if not digits:
        return ""
    if value.startswith("+"):
        return f"+{digits}"
    if len(digits) == 10:
        return f"+91{digits}"
    if len(digits) == 11 and digits.startswith("0"):
        return f"+91{digits[1:]}"
    return f"+{digits}"


def extract_whatsapp_message(payload: dict[str, Any]) -> WhatsAppInboundMessage:
    if not isinstance(payload, dict):
        raise ValueError("WhatsApp payload must be an object.")

    if payload.get("phoneNumber") or payload.get("message"):
        phone = normalize_phone_number(str(payload.get("phoneNumber") or payload.get("from") or ""))
        text = str(payload.get("message") or payload.get("text") or "").strip()
        name = _clean_string(payload.get("profileName") or payload.get("name"))
        return _build_inbound(phone, name, text, payload)

    value = _first_change_value(payload)
    messages = value.get("messages") if isinstance(value, dict) else None
    contacts = value.get("contacts") if isinstance(value, dict) else None
    message = messages[0] if isinstance(messages, list) and messages else {}
    contact = contacts[0] if isinstance(contacts, list) and contacts else {}

    phone = normalize_phone_number(str(message.get("from") or contact.get("wa_id") or ""))
    text_payload = message.get("text") if isinstance(message, dict) else None
    text = str(text_payload.get("body") if isinstance(text_payload, dict) else "").strip()
    profile = contact.get("profile") if isinstance(contact, dict) else None
    name = _clean_string(profile.get("name") if isinstance(profile, dict) else None)
    return _build_inbound(phone, name, text, payload)


async def process_whatsapp_inbound(payload: dict[str, Any], send_reply: bool = True) -> dict[str, Any]:
    if is_whatsapp_image_message(payload):
        return await handle_whatsapp_image_message(payload, send_reply=send_reply)
    if not _is_whatsapp_text_message(payload):
        phone = normalize_phone_number(_extract_payload_phone(payload))
        logger.info("Unsupported WhatsApp message type received phone=%s type=%s", phone, _extract_message_type(payload))
        if phone and send_reply:
            await send_whatsapp_reply(phone, UNSUPPORTED_MESSAGE_REPLY)
        return {"success": False, "phoneNumber": phone, "reply": UNSUPPORTED_MESSAGE_REPLY, "error": "unsupported_message_type"}

    inbound = extract_whatsapp_message(payload)
    logger.info(
        "WHATSAPP_INTAKE step=inbound_extracted inbound_phone=%s normalized_phone=%s text_chars=%s",
        _safe_payload_phone(payload),
        inbound.phone_number,
        len(inbound.text),
    )
    try:
        care_seeker = await get_or_create_care_seeker(inbound.phone_number, inbound.profile_name)
        care_seeker_id = _extract_id(care_seeker)
        if not care_seeker_id:
            raise NestInternalClientError("Care seeker response did not include an id.")
        logger.info("WHATSAPP_INTAKE step=care_seeker_ready care_seeker_id=%s", care_seeker_id)

        session = await get_or_create_active_session(care_seeker_id)
        session_id = _extract_id(session)
        if not session_id:
            raise NestInternalClientError("Conversation session response did not include an id.")
        logger.info("WHATSAPP_INTAKE step=session_ready care_seeker_id=%s session_id=%s", care_seeker_id, session_id)

        inbound_message = await save_conversation_message(session_id, "INBOUND", inbound.text, inbound.raw_payload)
        inbound_message_id = _extract_id(inbound_message)
        logger.info(
            "WHATSAPP_INTAKE step=inbound_saved session_id=%s message_id=%s",
            session_id,
            inbound_message_id,
        )
        recent_messages = _recent_messages(session_id)
        backend_active_incident, backend_missing_fields = await asyncio.gather(
            get_active_incident_by_phone(inbound.phone_number),
            get_incident_missing_fields_by_phone(inbound.phone_number),
        )
        existing_incident = _compact_incident_for_llm(backend_active_incident or _extract_existing_incident(session))
        context = build_llm_context(
            care_seeker,
            session,
            recent_messages,
            existing_incident,
            backend_missing_fields,
        )
        logger.info(
            "WHATSAPP_INTAKE step=llm_call_start care_seeker_id=%s session_id=%s recent_count=%s has_existing_incident=%s",
            care_seeker_id,
            session_id,
            len(recent_messages),
            context["existingIncident"] is not None,
        )
        llm_output = call_llm_for_incident_intake(context)
        logger.info(
            "WHATSAPP_INTAKE step=llm_result session_id=%s action=%s incident=%s",
            session_id,
            llm_output["action"],
            _safe_llm_log(llm_output),
        )

        incident_response = None
        reply_text = generate_or_use_reply(llm_output)
        if llm_output["action"] in {"CREATE_OR_UPDATE_INCIDENT", "ESCALATE_TO_HUMAN"}:
            try:
                logger.info(
                    "WHATSAPP_INTAKE step=ai_upsert_call care_seeker_id=%s session_id=%s called=true",
                    care_seeker_id,
                    session_id,
                )
                incident_response = await ai_upsert_incident(care_seeker_id, session_id, llm_output, existing_incident)
                _remember_active_incident(inbound.phone_number, llm_output.get("incident") or incident_response)
                logger.info(
                    "WHATSAPP_INTAKE step=ai_upsert_result session_id=%s incident_id=%s status=%s severity=%s",
                    session_id,
                    _extract_id(incident_response),
                    _extract_value(incident_response, "status"),
                    _extract_value(incident_response, "severity")
                    or llm_output.get("incident", {}).get("severity"),
                )
            except NestInternalClientError as exc:
                logger.warning(
                    "Nest incident ai-upsert failed care_seeker_id=%s session_id=%s error=%s",
                    care_seeker_id,
                    session_id,
                    exc,
                )
                reply_text = INCIDENT_SAVE_FALLBACK_REPLY
        else:
            logger.info(
                "WHATSAPP_INTAKE step=ai_upsert_call session_id=%s called=false action=%s",
                session_id,
                llm_output["action"],
            )

        outbound_message = await save_conversation_message(session_id, "OUTBOUND", reply_text)
        logger.info(
            "WHATSAPP_INTAKE step=outbound_saved session_id=%s message_id=%s saved=true",
            session_id,
            _extract_id(outbound_message),
        )
        if send_reply:
            await send_whatsapp_reply(inbound.phone_number, reply_text)

        return {
            "success": True,
            "phoneNumber": inbound.phone_number,
            "careSeekerId": care_seeker_id,
            "sessionId": session_id,
            "action": llm_output["action"],
            "reply": reply_text,
            "incidentResponse": incident_response,
        }
    except NestInternalClientError as exc:
        logger.warning("WhatsApp intake NestJS failure phone=%s error=%s", inbound.phone_number, exc)
        if send_reply:
            await send_whatsapp_reply(inbound.phone_number, INCIDENT_SAVE_FALLBACK_REPLY)
        return {
            "success": False,
            "phoneNumber": inbound.phone_number,
            "reply": INCIDENT_SAVE_FALLBACK_REPLY,
            "error": "nest_internal_failure",
        }


handleWhatsAppInbound = process_whatsapp_inbound


def normalized_message_payload(
    phone_number: str,
    message_text: str,
    profile_name: str | None = None,
    raw_payload: dict[str, Any] | None = None,
    message_type: str = "text",
    media: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "phoneNumber": phone_number,
        "message": message_text,
        "name": profile_name,
        "raw": raw_payload or {},
        "type": message_type,
        "media": media,
    }


async def get_or_create_care_seeker(phone_number: str, profile_name: str | None) -> Any:
    payload = {
        "phoneNumber": phone_number,
        "whatsappPhoneNumber": phone_number,
        "displayName": profile_name or "WhatsApp Care Seeker",
        "source": "WHATSAPP",
    }
    logger.info("Getting or creating care seeker phone=%s", phone_number)
    return await nest_internal_client.get_or_create_care_seeker(payload)


async def get_or_create_active_session(care_seeker_id: str) -> Any:
    payload = {"careSeekerId": care_seeker_id, "channel": "WHATSAPP"}
    logger.info("Getting or creating active conversation session care_seeker_id=%s", care_seeker_id)
    return await nest_internal_client.get_or_create_active_session(payload)


async def save_conversation_message(
    session_id: str,
    direction: str,
    text: str,
    raw_payload: dict[str, Any] | None = None,
) -> Any:
    payload = {
        "sessionId": session_id,
        "direction": direction,
        "messageType": "TEXT",
        "messageText": text,
    }
    if raw_payload is not None:
        payload["rawPayload"] = raw_payload
    logger.info("Saving conversation message session_id=%s direction=%s", session_id, direction)
    response = await nest_internal_client.create_conversation_message(payload)
    _remember_message(session_id, direction, text)
    return response


def is_whatsapp_image_message(payload: dict[str, Any]) -> bool:
    return _extract_message_type(payload) == "image"


def extract_whatsapp_image_message(payload: dict[str, Any]) -> WhatsAppImageMessage:
    if not isinstance(payload, dict):
        raise ValueError("WhatsApp payload must be an object.")
    logger.info("[WHATSAPP_IMAGE_RECEIVED]")

    phone = normalize_phone_number(_extract_payload_phone(payload))
    logger.info("[PHONE_NORMALIZED] phone_present=%s", bool(phone))
    if not phone:
        raise ValueError("WhatsApp sender phone number is required.")

    image_payload = _extract_image_payload(payload)
    media_payload = payload.get("media") if isinstance(payload.get("media"), dict) else {}
    media_id = str(
        image_payload.get("id")
        or image_payload.get("media_id")
        or media_payload.get("id")
        or media_payload.get("mediaId")
        or media_payload.get("media_id")
        or ""
    ).strip()
    if not media_id:
        logger.warning("[WHATSAPP_IMAGE_MEDIA_ID_MISSING]")
        raise ValueError("WhatsApp image media id is required.")
    logger.info("[WHATSAPP_IMAGE_MEDIA_ID_EXTRACTED] media_id_present=true")

    mime_type = str(
        image_payload.get("mime_type")
        or image_payload.get("mimeType")
        or media_payload.get("mime_type")
        or media_payload.get("mimeType")
        or "image/jpeg"
    ).strip()
    caption = _clean_string(image_payload.get("caption") or media_payload.get("caption") or payload.get("message"))
    media_url = _clean_string(image_payload.get("url") or media_payload.get("url"))

    return WhatsAppImageMessage(
        phone_number=phone,
        profile_name=_extract_profile_name(payload),
        media_id=media_id,
        mime_type=mime_type,
        caption=caption,
        media_url=media_url,
        raw_payload=payload,
    )


async def handle_whatsapp_image_message(payload: dict[str, Any], send_reply: bool = True) -> dict[str, Any]:
    try:
        image = extract_whatsapp_image_message(payload)
        care_seeker = await get_or_create_care_seeker(image.phone_number, image.profile_name)
        care_seeker_id = _extract_id(care_seeker)
        if not care_seeker_id:
            raise NestInternalClientError("Care seeker response did not include an id.")
        logger.info("[CARE_SEEKER_RESOLVED] care_seeker_id=%s", care_seeker_id)

        session = await get_or_create_active_session(care_seeker_id)
        session_id = _extract_id(session)
        if not session_id:
            raise NestInternalClientError("Conversation session response did not include an id.")
        logger.info("[SESSION_RESOLVED] session_id=%s", session_id)

        inbound_message = await save_inbound_image_message(session_id, image.caption, image.media_id, image.raw_payload)
        logger.info("[INBOUND_IMAGE_MESSAGE_SAVED] message_id=%s", _extract_id(inbound_message))

        had_existing_incident = _extract_existing_incident(session) is not None
        logger.info("[INCIDENT_DRAFT_ENSURE_STARTED] session_id=%s", session_id)
        incident = await ensure_draft_incident_for_session(care_seeker_id, session_id)
        incident_id = _extract_id(incident)
        if not incident_id:
            raise NestInternalClientError("Draft incident response did not include an id.")
        logger.info("[INCIDENT_DRAFT_ENSURED] incident_id=%s", incident_id)

        media = await download_whatsapp_media(image.media_id, image.mime_type, image.media_url)
        logger.info("[EVIDENCE_UPLOAD_STARTED] session_id=%s incident_id=%s", session_id, incident_id)
        evidence = await upload_image_evidence_to_nest(
            care_seeker_id=care_seeker_id,
            session_id=session_id,
            incident_id=incident_id,
            image_bytes=media.image_bytes,
            mime_type=media.mime_type,
            file_name=media.file_name,
            caption=image.caption,
        )
        logger.info("[EVIDENCE_UPLOAD_COMPLETED] evidence_id=%s", _extract_id(evidence))

        reply_text = IMAGE_UPLOAD_SUCCESS_REPLY if had_existing_incident else IMAGE_DRAFT_CREATED_REPLY
        outbound_message = await save_outbound_message(session_id, reply_text)
        logger.info("[OUTBOUND_MESSAGE_SAVED] message_id=%s", _extract_id(outbound_message))
        if send_reply:
            await send_whatsapp_reply(image.phone_number, reply_text)
            logger.info("[WHATSAPP_REPLY_SENT]")

        return {
            "success": True,
            "phoneNumber": image.phone_number,
            "careSeekerId": care_seeker_id,
            "sessionId": session_id,
            "incidentId": incident_id,
            "evidenceResponse": evidence,
            "reply": reply_text,
            "action": "UPLOAD_IMAGE_EVIDENCE",
        }
    except (NestInternalClientError, ValueError, httpx.HTTPError) as exc:
        logger.warning("[EVIDENCE_UPLOAD_FAILED] error=%s", exc)
        phone = normalize_phone_number(_extract_payload_phone(payload))
        if phone and send_reply:
            await send_whatsapp_reply(phone, IMAGE_UPLOAD_FAILURE_REPLY)
            logger.info("[WHATSAPP_REPLY_SENT]")
        return {"success": False, "phoneNumber": phone, "reply": IMAGE_UPLOAD_FAILURE_REPLY, "error": "image_upload_failed"}


async def handle_uploaded_whatsapp_image(
    phone_number: str,
    profile_name: str | None,
    caption: str | None,
    whatsapp_media_id: str,
    mime_type: str,
    raw_payload: dict[str, Any],
    image_bytes: bytes,
    file_name: str,
) -> dict[str, Any]:
    phone = normalize_phone_number(phone_number)
    try:
        if not phone:
            raise ValueError("WhatsApp sender phone number is required.")
        if not whatsapp_media_id:
            raise ValueError("WhatsApp media id is required.")
        if not image_bytes:
            raise ValueError("Image bytes are required.")
        if not mime_type.startswith("image/"):
            raise ValueError("Uploaded WhatsApp media must be image/*.")

        logger.info("[WHATSAPP_IMAGE_RECEIVED]")
        logger.info("[PHONE_NORMALIZED] phone_present=%s", bool(phone))
        logger.info("[WHATSAPP_IMAGE_MEDIA_ID_EXTRACTED] media_id_present=true")

        care_seeker = await get_or_create_care_seeker(phone, profile_name)
        care_seeker_id = _extract_id(care_seeker)
        if not care_seeker_id:
            raise NestInternalClientError("Care seeker response did not include an id.")
        logger.info("[CARE_SEEKER_RESOLVED] care_seeker_id=%s", care_seeker_id)

        session = await get_or_create_active_session(care_seeker_id)
        session_id = _extract_id(session)
        if not session_id:
            raise NestInternalClientError("Conversation session response did not include an id.")
        logger.info("[SESSION_RESOLVED] session_id=%s", session_id)

        inbound_message = await save_inbound_image_message(session_id, caption, whatsapp_media_id, raw_payload)
        logger.info("[INBOUND_IMAGE_MESSAGE_SAVED] message_id=%s", _extract_id(inbound_message))

        had_existing_incident = _extract_existing_incident(session) is not None
        logger.info("[INCIDENT_DRAFT_ENSURE_STARTED] session_id=%s", session_id)
        incident = await ensure_draft_incident_for_session(care_seeker_id, session_id)
        incident_id = _extract_id(incident)
        if not incident_id:
            raise NestInternalClientError("Draft incident response did not include an id.")
        logger.info("[INCIDENT_DRAFT_ENSURED] incident_id=%s", incident_id)

        logger.info("[EVIDENCE_UPLOAD_STARTED] session_id=%s incident_id=%s", session_id, incident_id)
        evidence = await upload_image_evidence_to_nest(
            care_seeker_id=care_seeker_id,
            session_id=session_id,
            incident_id=incident_id,
            image_bytes=image_bytes,
            mime_type=mime_type,
            file_name=file_name,
            caption=caption,
        )
        evidence_id = _extract_id(evidence)
        logger.info("[EVIDENCE_UPLOAD_COMPLETED] evidence_id=%s", evidence_id)

        reply_text = IMAGE_UPLOAD_SUCCESS_REPLY if had_existing_incident else IMAGE_DRAFT_CREATED_REPLY
        outbound_message = await save_outbound_message(session_id, reply_text)
        logger.info("[OUTBOUND_MESSAGE_SAVED] message_id=%s", _extract_id(outbound_message))

        return {
            "success": True,
            "replyText": reply_text,
            "evidenceId": evidence_id,
            "incidentId": incident_id,
            "careSeekerId": care_seeker_id,
            "sessionId": session_id,
        }
    except (NestInternalClientError, ValueError, httpx.HTTPError) as exc:
        logger.warning("[EVIDENCE_UPLOAD_FAILED] error=%s", exc)
        return {
            "success": False,
            "replyText": IMAGE_UPLOAD_FAILURE_REPLY,
            "phoneNumber": phone,
            "error": "image_upload_failed",
        }


async def save_inbound_image_message(
    session_id: str,
    caption: str | None,
    media_id: str,
    raw_payload: dict[str, Any],
) -> Any:
    payload = {
        "sessionId": session_id,
        "direction": "INBOUND",
        "messageType": "IMAGE",
        "messageText": caption or "[Image received]",
        "mediaId": media_id,
        "rawPayload": raw_payload,
    }
    response = await nest_internal_client.create_conversation_message(payload)
    _remember_message(session_id, "INBOUND", payload["messageText"])
    return response


async def ensure_draft_incident_for_session(care_seeker_id: str, session_id: str) -> Any:
    payload = {"careSeekerId": care_seeker_id, "sessionId": session_id, "source": "WHATSAPP"}
    return await nest_internal_client.ensure_draft_incident_for_session(payload)


async def get_incident_missing_fields_by_phone(phone_number: str) -> Any | None:
    try:
        return await nest_internal_client.get_incident_missing_fields_by_phone(phone_number)
    except NestInternalClientError as exc:
        logger.warning("Nest incident missing-fields lookup failed phone=%s error=%s", phone_number, exc)
        return None


async def get_active_incident_by_phone(phone_number: str) -> dict[str, Any] | None:
    cached = _ACTIVE_INCIDENT_CACHE_BY_PHONE.get(phone_number)
    now = time.monotonic()
    if cached and now - cached[0] <= ACTIVE_INCIDENT_CACHE_TTL_SECONDS:
        return cached[1]

    try:
        incident = await nest_internal_client.get_active_incident_by_phone(phone_number)
    except NestInternalClientError as exc:
        logger.warning("Nest active incident lookup failed phone=%s error=%s", phone_number, exc)
        return None

    compact = _compact_incident_for_llm(incident)
    _ACTIVE_INCIDENT_CACHE_BY_PHONE[phone_number] = (now, compact)
    return compact


async def download_whatsapp_media(
    media_id: str,
    mime_type: str | None = None,
    media_url: str | None = None,
) -> WhatsAppDownloadedMedia:
    if not media_id:
        raise ValueError("WhatsApp media id is required.")
    if not settings.whatsapp_access_token and not media_url:
        raise ValueError("WHATSAPP_ACCESS_TOKEN or forwarded media URL is required to download WhatsApp media.")

    headers = {"Authorization": f"Bearer {settings.whatsapp_access_token}"} if settings.whatsapp_access_token else {}
    resolved_mime_type = str(mime_type or "image/jpeg").strip()
    download_url = media_url
    async with httpx.AsyncClient(timeout=max(settings.nest_internal_timeout_seconds, 30.0)) as client:
        if settings.whatsapp_access_token:
            metadata_url = f"https://graph.facebook.com/{settings.whatsapp_api_version}/{media_id}"
            logger.info("[WHATSAPP_MEDIA_METADATA_REQUEST_STARTED] media_id_present=true")
            metadata_response = await client.get(metadata_url, headers=headers)
            logger.info("[WHATSAPP_MEDIA_METADATA_REQUEST_COMPLETED] status=%s", metadata_response.status_code)
            if metadata_response.status_code != 200:
                raise ValueError(f"WhatsApp media metadata request returned {metadata_response.status_code}.")
            metadata = metadata_response.json()
            download_url = str(metadata.get("url") or download_url or "").strip()
            resolved_mime_type = str(metadata.get("mime_type") or resolved_mime_type).strip()
        elif download_url:
            logger.info("[WHATSAPP_MEDIA_METADATA_REQUEST_STARTED] skipped=forwarded_media_url")
            logger.info("[WHATSAPP_MEDIA_METADATA_REQUEST_COMPLETED] status=skipped")

        if not download_url:
            raise ValueError("WhatsApp media download URL is missing.")
        if not resolved_mime_type.startswith("image/"):
            raise ValueError("WhatsApp media is not an image.")

        logger.info("[WHATSAPP_MEDIA_DOWNLOAD_STARTED] media_id_present=true")
        media_response = await client.get(download_url, headers=headers)
        logger.info("[WHATSAPP_MEDIA_DOWNLOAD_COMPLETED] status=%s bytes=%s", media_response.status_code, len(media_response.content))
        if media_response.status_code != 200:
            raise ValueError(f"WhatsApp media download returned {media_response.status_code}.")
        image_bytes = media_response.content
        if not image_bytes:
            raise ValueError("WhatsApp media download returned empty image bytes.")

    return WhatsAppDownloadedMedia(
        image_bytes=image_bytes,
        mime_type=resolved_mime_type,
        file_name=_generated_image_file_name(media_id, resolved_mime_type),
    )


async def upload_image_evidence_to_nest(
    care_seeker_id: str,
    session_id: str,
    incident_id: str,
    image_bytes: bytes,
    mime_type: str,
    file_name: str,
    caption: str | None,
) -> Any:
    if not image_bytes:
        raise ValueError("Image bytes are required.")
    if not mime_type.startswith("image/"):
        raise ValueError("Evidence upload mime_type must be image/*.")
    data = {
        "careSeekerId": care_seeker_id,
        "sessionId": session_id,
        "incidentId": incident_id,
        "source": "WHATSAPP",
        "uploadedBy": "CARE_SEEKER",
        "caption": caption or "",
    }
    return await nest_internal_client.upload_image_evidence(data, file_name, image_bytes, mime_type)


async def save_outbound_message(session_id: str, reply_text: str) -> Any:
    return await save_conversation_message(session_id, "OUTBOUND", reply_text)


def build_llm_context(
    care_seeker: Any,
    session: Any,
    recent_messages: list[dict[str, Any]],
    existing_incident: Any = None,
    backend_missing_fields: Any = None,
) -> dict[str, Any]:
    return {
        "careSeeker": {
            "id": _extract_id(care_seeker),
            "whatsappPhoneNumber": _extract_value(care_seeker, "whatsappPhoneNumber")
            or _extract_value(care_seeker, "phoneNumber")
            or _extract_value(care_seeker, "phone"),
        },
        "session": {"id": _extract_id(session), "channel": "WHATSAPP"},
        "recentMessages": recent_messages,
        "existingIncident": existing_incident,
        "backendActiveIncident": existing_incident,
        "backendMissingFields": backend_missing_fields,
        "instruction": "Update the same active incident for this WhatsApp conversation session. Do not create a separate incident for follow-up messages. Use backendMissingFields as the current backend-confirmed missing-field state when it is present. Softly collect missing details over time by asking at most one gentle optional follow-up question in each normal reply. Do not ask for a missing field that is not present in backendMissingFields. Remove a missing field only when the latest conversation clearly provides it or the care seeker declines, refuses, says they do not know, or says they cannot share it. When a field is declined, do not ask for it again; omit it from missingFields and mention the declined field in caseNote so the backend can persist that decision through ai-upsert.",
    }


def call_llm_for_incident_intake(context: dict[str, Any]) -> dict[str, Any]:
    try:
        client = get_llm_client(settings)
        if client is None:
            raise RuntimeError("LLM client is not configured.")
        prompt = _build_intake_prompt(context)
        output = client.generate_json(
            prompt,
            temperature=settings.llm_supervisor_temperature,
            max_output_tokens=max(settings.llm_max_output_tokens, 900),
            thinking_budget=settings.llm_thinking_budget,
        )
        validated = validate_llm_json(output)
        logger.info("WHATSAPP_INTAKE step=llm_raw_validated action=%s incident=%s", validated["action"], _safe_llm_log(validated))
        return validated
    except Exception as exc:
        logger.warning("LLM incident intake failed error=%s", exc)
        return validate_llm_json(FALLBACK_LLM_OUTPUT)


def validate_llm_json(output: Any) -> dict[str, Any]:
    if isinstance(output, str):
        output = parse_json_object(output)
    if not isinstance(output, dict):
        raise ValueError("LLM output must be a JSON object.")

    action = str(output.get("action") or "").strip().upper()
    if action not in VALID_ACTIONS:
        raise ValueError("LLM output action is invalid.")

    reply = str(output.get("replyToCareSeeker") or "").strip()
    if not reply:
        raise ValueError("LLM output replyToCareSeeker is required.")

    validated = {"action": action, "replyToCareSeeker": reply}
    if action in {"CREATE_OR_UPDATE_INCIDENT", "ESCALATE_TO_HUMAN"}:
        incident = output.get("incident")
        if not isinstance(incident, dict):
            raise ValueError("LLM output incident is required for incident actions.")
        validated["incident"] = _validate_incident(incident, action)
    elif isinstance(output.get("incident"), dict):
        validated["incident"] = _validate_incident(output["incident"], action)

    return validated


async def ai_upsert_incident(
    care_seeker_id: str,
    session_id: str,
    llm_output: dict[str, Any],
    existing_incident: dict[str, Any] | None = None,
) -> Any:
    incident = llm_output.get("incident")
    if not isinstance(incident, dict):
        raise NestInternalClientError("Cannot ai-upsert incident without incident output.")
    incident = _merge_incident_text_fields(existing_incident, incident)
    llm_output["incident"] = incident
    payload = {
        "careSeekerId": care_seeker_id,
        "sessionId": session_id,
        "source": "WHATSAPP",
        "llmOutput": incident,
    }
    logger.info("AI upserting incident care_seeker_id=%s session_id=%s", care_seeker_id, session_id)
    return await nest_internal_client.ai_upsert_incident(payload)


def generate_or_use_reply(llm_output: dict[str, Any]) -> str:
    reply = str(llm_output.get("replyToCareSeeker") or "").strip()
    return reply or FALLBACK_LLM_OUTPUT["replyToCareSeeker"]


async def send_whatsapp_reply(phone_number: str, reply_text: str) -> dict[str, Any]:
    if not settings.whatsapp_send_url:
        logger.info("WhatsApp send skipped; WHATSAPP_SEND_URL is not configured phone=%s", phone_number)
        return {"sent": False, "reason": "whatsapp_send_not_configured"}

    headers = {}
    if settings.whatsapp_access_token:
        headers["Authorization"] = f"Bearer {settings.whatsapp_access_token}"
    payload = {"to": phone_number, "text": reply_text}
    try:
        async with httpx.AsyncClient(timeout=settings.nest_internal_timeout_seconds) as client:
            response = await client.post(settings.whatsapp_send_url, json=payload, headers=headers)
            logger.info("WhatsApp send request status=%s phone=%s", response.status_code, phone_number)
            response.raise_for_status()
            return response.json() if response.content else {"sent": True}
    except httpx.HTTPError as exc:
        logger.warning("WhatsApp send failed phone=%s error=%s", phone_number, exc)
        return {"sent": False, "error": "whatsapp_send_failed"}


def _validate_incident(incident: dict[str, Any], action: str) -> dict[str, Any]:
    severity = _enum_or_unknown(incident.get("severity"), VALID_SEVERITIES)
    urgency = _enum_or_unknown(incident.get("urgency"), VALID_URGENCIES)
    needs_human_review = bool(incident.get("needsHumanReview"))
    if action == "ESCALATE_TO_HUMAN" or severity in {"HIGH", "CRITICAL"} or urgency in {"URGENT", "IMMEDIATE"}:
        needs_human_review = True

    return {
        "title": _nullable_string(incident.get("title")),
        "summary": _nullable_string(incident.get("summary")),
        "description": _nullable_string(incident.get("description")),
        "category": _enum_or_unknown(incident.get("category"), VALID_CATEGORIES),
        "severity": severity,
        "urgency": urgency,
        "incidentDateText": _nullable_string(incident.get("incidentDateText")),
        "locationText": _nullable_string(incident.get("locationText")),
        "perpetratorRelation": _nullable_string(incident.get("perpetratorRelation")),
        "riskSignals": _string_list(incident.get("riskSignals")),
        "missingFields": _string_list(incident.get("missingFields")),
        "needsHumanReview": needs_human_review,
        "aiConfidence": _confidence(incident.get("aiConfidence")),
        "caseNote": _nullable_string(incident.get("caseNote")),
    }


def _build_intake_prompt(context: dict[str, Any]) -> str:
    return "\n\n".join(
        [
            "You are SakhiSafe AI Intake Assistant.",
            "Your role: Convert care seeker WhatsApp conversations into structured incident records for a case worker dashboard.",
            "You are not a police officer, lawyer, therapist, or emergency service. Be calm, trauma-informed, concise, and practical.",
            "Rules: create or update one organized incident for abuse, violence, threat, stalking, harassment, coercion, forced control, or danger. If there is already an active incident, update the same incident instead of creating a new one. Never invent facts. Mark unknown fields as null or UNKNOWN. Ask only one useful follow-up question. Return JSON only and never markdown.",
            "Incident update rules: backendActiveIncident is the latest backend incident snapshot and is the source of truth for previously saved title, summary, description, case notes, risk signals, and classification. Preserve previous summary and description facts. When the latest message adds details, merge them into the existing summary and description instead of replacing them with only the new message. Only remove or correct previous details when the care seeker clearly corrects or contradicts them.",
            "Missing-field rules: If backendMissingFields has items, keep collecting them softly over time. In normal replies, include at most one optional, survivor-friendly question about the most useful missing field. If the care seeker says no, not now, I do not know, cannot share, or otherwise declines a missing field, treat that field as handled: remove it from incident.missingFields, do not ask it again, and record the refusal in incident.caseNote. If a decline or new detail changes missingFields, use CREATE_OR_UPDATE_INCIDENT so the backend receives the update through ai-upsert.",
            "If immediate danger is indicated, ask whether it is safe to continue messaging and suggest contacting local emergency support if they can safely do so.",
            "JSON schema: {\"action\":\"CONTINUE_CONVERSATION | CREATE_OR_UPDATE_INCIDENT | ESCALATE_TO_HUMAN | NO_ACTION\",\"replyToCareSeeker\":\"string\",\"incident\":{\"title\":\"string or null\",\"summary\":\"string or null\",\"description\":\"string or null\",\"category\":\"DOMESTIC_VIOLENCE | PHYSICAL_ABUSE | EMOTIONAL_ABUSE | SEXUAL_ABUSE | FINANCIAL_ABUSE | STALKING | HARASSMENT | THREAT | OTHER | UNKNOWN\",\"severity\":\"LOW | MEDIUM | HIGH | CRITICAL | UNKNOWN\",\"urgency\":\"LOW | SOON | URGENT | IMMEDIATE | UNKNOWN\",\"incidentDateText\":\"string or null\",\"locationText\":\"string or null\",\"perpetratorRelation\":\"string or null\",\"riskSignals\":[\"string\"],\"missingFields\":[\"string\"],\"needsHumanReview\":true,\"aiConfidence\":0.0,\"caseNote\":\"string or null\"}}",
            f"Conversation context JSON:\n{json.dumps(context, ensure_ascii=True)}",
        ]
    )


def _is_whatsapp_text_message(payload: dict[str, Any]) -> bool:
    message_type = _extract_message_type(payload)
    return message_type in {"", "text"}


def _extract_message_type(payload: dict[str, Any]) -> str:
    if not isinstance(payload, dict):
        return ""
    direct_type = payload.get("type") or payload.get("messageType")
    if isinstance(direct_type, str) and direct_type:
        return direct_type.strip().lower()

    message = payload.get("message")
    if isinstance(message, dict):
        nested_type = message.get("type")
        if isinstance(nested_type, str) and nested_type:
            return nested_type.strip().lower()

    value = _first_change_value(payload)
    messages = value.get("messages") if isinstance(value, dict) else None
    raw_message = messages[0] if isinstance(messages, list) and messages else {}
    raw_type = raw_message.get("type") if isinstance(raw_message, dict) else None
    return str(raw_type or "").strip().lower()


def _extract_payload_phone(payload: dict[str, Any]) -> str:
    if not isinstance(payload, dict):
        return ""
    if payload.get("phoneNumber") or payload.get("from"):
        return str(payload.get("phoneNumber") or payload.get("from") or "")

    sender = payload.get("sender")
    if isinstance(sender, dict) and sender.get("id"):
        return str(sender.get("id") or "")

    value = _first_change_value(payload)
    messages = value.get("messages") if isinstance(value, dict) else None
    contacts = value.get("contacts") if isinstance(value, dict) else None
    message = messages[0] if isinstance(messages, list) and messages else {}
    contact = contacts[0] if isinstance(contacts, list) and contacts else {}
    return str(message.get("from") or contact.get("wa_id") or "")


def _extract_profile_name(payload: dict[str, Any]) -> str | None:
    if not isinstance(payload, dict):
        return None
    direct_name = _clean_string(payload.get("profileName") or payload.get("name"))
    if direct_name:
        return direct_name

    sender = payload.get("sender")
    if isinstance(sender, dict):
        sender_name = _clean_string(sender.get("name"))
        if sender_name:
            return sender_name

    value = _first_change_value(payload)
    contacts = value.get("contacts") if isinstance(value, dict) else None
    contact = contacts[0] if isinstance(contacts, list) and contacts else {}
    profile = contact.get("profile") if isinstance(contact, dict) else None
    return _clean_string(profile.get("name") if isinstance(profile, dict) else None)


def _extract_image_payload(payload: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(payload, dict):
        return {}
    image = payload.get("image")
    if isinstance(image, dict):
        return image

    raw = payload.get("raw")
    if isinstance(raw, dict):
        raw_image = _extract_image_payload(raw)
        if raw_image:
            return raw_image

    value = _first_change_value(payload)
    messages = value.get("messages") if isinstance(value, dict) else None
    message = messages[0] if isinstance(messages, list) and messages else {}
    image = message.get("image") if isinstance(message, dict) else None
    return image if isinstance(image, dict) else {}


def _generated_image_file_name(media_id: str, mime_type: str) -> str:
    extension_by_mime = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }
    extension = extension_by_mime.get(mime_type.lower(), ".jpg")
    safe_media_id = re.sub(r"[^A-Za-z0-9_.-]", "-", media_id).strip("-") or "media"
    return f"whatsapp-{safe_media_id}{extension}"


def _first_change_value(payload: dict[str, Any]) -> dict[str, Any]:
    entries = payload.get("entry")
    if not isinstance(entries, list) or not entries:
        return {}
    changes = entries[0].get("changes") if isinstance(entries[0], dict) else None
    if not isinstance(changes, list) or not changes:
        return {}
    value = changes[0].get("value") if isinstance(changes[0], dict) else None
    return value if isinstance(value, dict) else {}


def _build_inbound(phone: str, name: str | None, text: str, payload: dict[str, Any]) -> WhatsAppInboundMessage:
    if not phone:
        raise ValueError("WhatsApp sender phone number is required.")
    if not text:
        raise ValueError("WhatsApp text message body is required.")
    return WhatsAppInboundMessage(phone_number=phone, profile_name=name, text=text, raw_payload=payload)


def _remember_message(session_id: str, direction: str, text: str) -> None:
    messages = _RECENT_MESSAGES_BY_SESSION.setdefault(session_id, [])
    role = "assistant" if direction == "OUTBOUND" else "user"
    messages.append({"role": role, "content": text})
    del messages[:-12]


def _recent_messages(session_id: str) -> list[dict[str, Any]]:
    return list(_RECENT_MESSAGES_BY_SESSION.get(session_id, []))


def _extract_existing_incident(session: Any) -> Any:
    if not isinstance(session, dict):
        return None
    for key in ("activeIncident", "incident", "existingIncident"):
        if session.get(key):
            return session[key]
    data = session.get("data")
    if isinstance(data, dict):
        return _extract_existing_incident(data)
    return None


def _compact_incident_for_llm(incident: Any) -> dict[str, Any] | None:
    if not isinstance(incident, dict):
        return None
    compact = {
        "incidentId": _extract_id(incident),
        "title": _first_text(incident, ("title",), 180),
        "summary": _first_text(incident, ("summary",), 700),
        "description": _first_text(incident, ("description", "incidentDescription"), 1400),
        "category": _first_text(incident, ("category", "incidentCategory"), 80),
        "severity": _first_text(incident, ("severity", "riskLevel"), 40),
        "urgency": _first_text(incident, ("urgency",), 40),
        "incidentDateText": _first_text(incident, ("incidentDateText", "incidentDate"), 120),
        "locationText": _first_text(incident, ("locationText", "location"), 180),
        "perpetratorRelation": _first_text(incident, ("perpetratorRelation",), 180),
        "riskSignals": _first_list(incident, ("riskSignals",), 8, 160),
        "missingFields": _first_list(incident, ("missingFields",), 8, 120),
        "caseNote": _first_text(incident, ("caseNote", "latestCaseNote", "notes"), 700),
        "aiConfidence": _extract_value(incident, "aiConfidence"),
        "updatedAt": _first_text(incident, ("updatedAt",), 80),
    }
    return {key: value for key, value in compact.items() if value not in (None, [], "")}


def _merge_incident_text_fields(existing_incident: dict[str, Any] | None, incident: dict[str, Any]) -> dict[str, Any]:
    if not existing_incident:
        return incident

    merged = dict(incident)
    for key in ("summary", "description"):
        existing_text = _clean_string(existing_incident.get(key))
        new_text = _clean_string(merged.get(key))
        if not existing_text:
            continue
        if not new_text:
            merged[key] = existing_text
        elif _looks_like_narrow_rewrite(existing_text, new_text):
            label = "Additional update"
            merged[key] = f"{existing_text}\n\n{label}: {new_text}"
    return merged


def _looks_like_narrow_rewrite(existing_text: str, new_text: str) -> bool:
    if len(new_text) >= max(120, int(len(existing_text) * 0.7)):
        return False
    existing_words = set(re.findall(r"[a-z0-9]+", existing_text.lower()))
    new_words = set(re.findall(r"[a-z0-9]+", new_text.lower()))
    if not existing_words or not new_words:
        return False
    overlap = len(existing_words & new_words) / max(len(existing_words), 1)
    return overlap < 0.45


def _remember_active_incident(phone_number: str, incident: Any) -> None:
    _ACTIVE_INCIDENT_CACHE_BY_PHONE[phone_number] = (time.monotonic(), _compact_incident_for_llm(incident))


def _first_text(payload: dict[str, Any], keys: tuple[str, ...], limit: int) -> str | None:
    for key in keys:
        value = _clean_string(_extract_value(payload, key))
        if value:
            return _truncate_text(value, limit)
    return None


def _first_list(payload: dict[str, Any], keys: tuple[str, ...], max_items: int, item_limit: int) -> list[str]:
    for key in keys:
        values = _string_list(_extract_value(payload, key))
        if values:
            return [_truncate_text(value, item_limit) for value in values[:max_items]]
    return []


def _truncate_text(value: str, limit: int) -> str:
    cleaned = str(value or "").strip()
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[: limit - 3].rstrip() + "..."


def _extract_id(payload: Any) -> str | None:
    if not isinstance(payload, dict):
        return None
    for key in ("id", "careSeekerId", "sessionId", "conversationSessionId"):
        value = payload.get(key)
        if value:
            return str(value)
    data = payload.get("data")
    if isinstance(data, dict):
        return _extract_id(data)
    return None


def _extract_value(payload: Any, key: str) -> Any:
    if not isinstance(payload, dict):
        return None
    if payload.get(key) is not None:
        return payload.get(key)
    data = payload.get("data")
    if isinstance(data, dict):
        return _extract_value(data, key)
    return None


def _clean_string(value: Any) -> str | None:
    cleaned = str(value or "").strip()
    return cleaned or None


def _nullable_string(value: Any) -> str | None:
    if value is None:
        return None
    cleaned = str(value).strip()
    if not cleaned or cleaned.upper() in {"NULL", "UNKNOWN"}:
        return None if cleaned.upper() == "NULL" else "UNKNOWN"
    return cleaned


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _enum_or_unknown(value: Any, allowed: set[str]) -> str:
    normalized = str(value or "UNKNOWN").strip().upper()
    return normalized if normalized in allowed else "UNKNOWN"


def _confidence(value: Any) -> float:
    try:
        return max(0.0, min(1.0, float(value)))
    except (TypeError, ValueError):
        return 0.0


def _safe_payload_phone(payload: dict[str, Any]) -> str | None:
    if not isinstance(payload, dict):
        return None
    if payload.get("phoneNumber") or payload.get("from"):
        return str(payload.get("phoneNumber") or payload.get("from"))
    value = _first_change_value(payload)
    messages = value.get("messages") if isinstance(value, dict) else None
    if isinstance(messages, list) and messages:
        return str(messages[0].get("from") or "")
    return None


def _safe_llm_log(llm_output: dict[str, Any]) -> dict[str, Any]:
    incident = llm_output.get("incident")
    if not isinstance(incident, dict):
        return {"present": False}
    return {
        "present": True,
        "title_present": bool(incident.get("title")),
        "summary_present": bool(incident.get("summary")),
        "description_present": bool(incident.get("description")),
        "category": incident.get("category"),
        "severity": incident.get("severity"),
        "urgency": incident.get("urgency"),
        "riskSignalsCount": len(incident.get("riskSignals") or []),
        "missingFieldsCount": len(incident.get("missingFields") or []),
        "needsHumanReview": incident.get("needsHumanReview"),
        "aiConfidence": incident.get("aiConfidence"),
    }
