import logging
import httpx
import asyncio
import json
from dataclasses import dataclass
from urllib.parse import urlparse

from app.models.message import NormalisedMessage
from app.config import get_settings

from typing import Optional

logger = logging.getLogger("forwarder-service")

IMAGE_FORWARD_FAILURE_REPLY = "I received your image, but I could not attach it properly right now. You may try sending it again."


@dataclass(frozen=True)
class DownloadedWhatsAppImage:
    content: bytes
    mime_type: str
    filename: str


async def forward_message(msg: NormalisedMessage) -> Optional[str]:
    """
    HTTP POSTs the NormalizedMessage to the downstream endpoint.
    Safely handles exceptions to prevent crashing background tasks.
    """
    settings = get_settings()
    
    # 1. Check if TARGET_URL is configured
    if not settings.TARGET_URL:
        logger.error("Downstream forwarding aborted: TARGET_URL is not configured in the environment.")
        return None

    if msg.message.type.lower() == "image":
        return await forward_image_message(msg)

    # 2. Build headers
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Messaging-Service/0.1.0"
    }
    if settings.TARGET_AUTH_HEADER:
        headers["Authorization"] = settings.TARGET_AUTH_HEADER

    # 3. Serialize and post
    logger.info(f"Forwarding message {msg.message_id} to downstream target: {settings.TARGET_URL}")
    payload = msg.model_dump()
    logger.info(
        "Downstream payload summary: source=%s sender_id=%s message_id=%s message_type=%s",
        payload.get("source"),
        payload.get("sender", {}).get("id"),
        payload.get("message_id"),
        payload.get("message", {}).get("type"),
    )

    timeout = httpx.Timeout(
        connect=min(10, settings.TARGET_TIMEOUT_SECONDS),
        read=settings.TARGET_TIMEOUT_SECONDS,
        write=min(10, settings.TARGET_TIMEOUT_SECONDS),
        pool=min(10, settings.TARGET_TIMEOUT_SECONDS),
    )
    max_attempts = max(1, settings.TARGET_MAX_RETRIES + 1)

    for attempt in range(1, max_attempts + 1):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    settings.TARGET_URL,
                    json=payload,
                    headers=headers
                )

            response.raise_for_status()
            logger.info(
                f"Successfully forwarded message {msg.message_id}. "
                f"Status: {response.status_code}. Attempt: {attempt}/{max_attempts}"
            )

            data = response.json()
            if isinstance(data, dict) and "response" in data:
                return data["response"]
            return None
        except httpx.HTTPStatusError as e:
            logger.error(
                f"Failed forwarding message {msg.message_id}. "
                f"HTTP status error: {e.response.status_code}. Response: {e.response.text}. "
                f"Attempt: {attempt}/{max_attempts}."
            )
            return None
        except (httpx.RequestError, httpx.TimeoutException) as e:
            logger.warning(
                f"Downstream request failed for message {msg.message_id}: {type(e).__name__}: {repr(e)}. "
                f"Attempt: {attempt}/{max_attempts}"
            )
            if attempt < max_attempts:
                await asyncio.sleep(0.5 * attempt)
                continue
            logger.error(
                f"Failed forwarding message {msg.message_id} after retries."
            )
        except Exception as e:
            logger.error(
                f"Unexpected exception during message forwarding {msg.message_id}: {e}.",
                exc_info=True
            )
            return None
    
    return None


async def forward_image_message(msg: NormalisedMessage) -> Optional[str]:
    settings = get_settings()
    media_id = _extract_media_id(msg)
    caption = msg.media.caption if msg.media else msg.message.text
    mime_type = (msg.media.mime_type if msg.media and msg.media.mime_type else "image/jpeg").strip()

    logger.info("[WHATSAPP_IMAGE_RECEIVED]")
    if not media_id:
        logger.error("WhatsApp image media id is missing.")
        return IMAGE_FORWARD_FAILURE_REPLY
    logger.info("[WHATSAPP_IMAGE_MEDIA_ID_EXTRACTED]")

    try:
        image = await download_whatsapp_image(media_id, mime_type)
    except Exception as exc:
        logger.error("WhatsApp image download failed safely: %s", exc)
        return IMAGE_FORWARD_FAILURE_REPLY

    ingest_url = _media_ingest_url(settings)
    headers = {"User-Agent": "Messaging-Service/0.1.0"}
    if settings.TARGET_AUTH_HEADER:
        headers["Authorization"] = settings.TARGET_AUTH_HEADER

    data = {
        "fromPhone": msg.sender.id,
        "messageType": "IMAGE",
        "whatsappMediaId": media_id,
        "mimeType": image.mime_type,
        "rawPayload": json.dumps(msg.raw),
    }
    if msg.sender.name:
        data["profileName"] = msg.sender.name
    if caption:
        data["caption"] = caption

    files = {"file": (image.filename, image.content, image.mime_type)}
    timeout = httpx.Timeout(
        connect=min(10, settings.TARGET_TIMEOUT_SECONDS),
        read=settings.TARGET_TIMEOUT_SECONDS,
        write=settings.TARGET_TIMEOUT_SECONDS,
        pool=min(10, settings.TARGET_TIMEOUT_SECONDS),
    )

    try:
        logger.info("[AI_MEDIA_INGEST_STARTED]")
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(ingest_url, data=data, files=files, headers=headers)
        if response.status_code >= 400:
            logger.error("[AI_MEDIA_INGEST_FAILED] status=%s body=%s", response.status_code, response.text[:200])
            return IMAGE_FORWARD_FAILURE_REPLY
        logger.info("[AI_MEDIA_INGEST_COMPLETED] status=%s", response.status_code)
        payload = response.json() if response.content else {}
        if isinstance(payload, dict):
            return payload.get("replyText") or payload.get("response") or IMAGE_FORWARD_FAILURE_REPLY
        return IMAGE_FORWARD_FAILURE_REPLY
    except (httpx.RequestError, httpx.TimeoutException) as exc:
        logger.error("[AI_MEDIA_INGEST_FAILED] error=%s", exc)
        return IMAGE_FORWARD_FAILURE_REPLY


async def download_whatsapp_image(media_id: str, fallback_mime_type: str | None = None) -> DownloadedWhatsAppImage:
    settings = get_settings()
    if not settings.ACCESS_TOKEN:
        raise ValueError("ACCESS_TOKEN is required to download WhatsApp media.")

    headers = {"Authorization": f"Bearer {settings.ACCESS_TOKEN}"}
    metadata_url = f"https://graph.facebook.com/{settings.GRAPH_VERSION}/{media_id}"

    async with httpx.AsyncClient(timeout=30.0) as client:
        logger.info("[WHATSAPP_MEDIA_METADATA_REQUEST_STARTED]")
        metadata_response = await client.get(metadata_url, headers=headers)
        logger.info("[WHATSAPP_MEDIA_METADATA_REQUEST_COMPLETED] status=%s", metadata_response.status_code)
        if metadata_response.status_code != 200:
            raise ValueError(f"WhatsApp media metadata request returned {metadata_response.status_code}.")

        metadata = metadata_response.json()
        media_url = str(metadata.get("url") or "").strip()
        mime_type = str(metadata.get("mime_type") or fallback_mime_type or "image/jpeg").strip()
        if not media_url:
            raise ValueError("WhatsApp media metadata response did not include url.")
        if not mime_type.startswith("image/"):
            raise ValueError("WhatsApp media mime_type must be image/*.")

        logger.info("[WHATSAPP_MEDIA_DOWNLOAD_STARTED]")
        media_response = await client.get(media_url, headers=headers)
        logger.info("[WHATSAPP_MEDIA_DOWNLOAD_COMPLETED] status=%s bytes=%s", media_response.status_code, len(media_response.content))
        if media_response.status_code != 200:
            raise ValueError(f"WhatsApp media download returned {media_response.status_code}.")
        if not media_response.content:
            raise ValueError("WhatsApp media download returned empty image bytes.")

    return DownloadedWhatsAppImage(
        content=media_response.content,
        mime_type=mime_type,
        filename=_safe_image_filename(media_id, mime_type),
    )


def _extract_media_id(msg: NormalisedMessage) -> str:
    if msg.media and msg.media.id:
        return msg.media.id
    raw_message = _first_raw_message(msg.raw)
    image = raw_message.get("image") if isinstance(raw_message, dict) else None
    if isinstance(image, dict):
        return str(image.get("id") or "").strip()
    return ""


def _first_raw_message(raw_payload: dict) -> dict:
    entries = raw_payload.get("entry") if isinstance(raw_payload, dict) else None
    if not isinstance(entries, list) or not entries:
        return {}
    changes = entries[0].get("changes") if isinstance(entries[0], dict) else None
    if not isinstance(changes, list) or not changes:
        return {}
    value = changes[0].get("value") if isinstance(changes[0], dict) else None
    messages = value.get("messages") if isinstance(value, dict) else None
    return messages[0] if isinstance(messages, list) and messages and isinstance(messages[0], dict) else {}


def _media_ingest_url(settings) -> str:
    if settings.AI_SERVICE_BASE_URL:
        return f"{settings.AI_SERVICE_BASE_URL.rstrip('/')}/internal/v1/whatsapp/media-ingest"
    parsed = urlparse(settings.TARGET_URL)
    if parsed.scheme and parsed.netloc:
        return f"{parsed.scheme}://{parsed.netloc}/internal/v1/whatsapp/media-ingest"
    return settings.TARGET_URL


def _safe_image_filename(media_id: str, mime_type: str) -> str:
    extensions = {
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
    }
    extension = extensions.get(mime_type.lower(), "jpg")
    safe_media_id = "".join(char if char.isalnum() or char in "._-" else "-" for char in media_id).strip("-")
    return f"whatsapp-{safe_media_id or 'media'}.{extension}"
