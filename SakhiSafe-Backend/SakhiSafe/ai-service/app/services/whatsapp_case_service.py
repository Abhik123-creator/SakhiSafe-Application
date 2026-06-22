import logging
from typing import Any

from app.clients.nest_internal_client import NestInternalClientError, nest_internal_client
from app.core.phone import normalize_phone_for_api, phone_lookup_variants
from app.services.case_draft_service import build_case_draft


logger = logging.getLogger("sakhi-ai-service.whatsapp_case")

CRITICAL_SIGNALS = (
    "he will kill me",
    "kill",
    "knife",
    "gun",
    "weapon",
    "bleeding",
    "locked",
    "trapped",
    "suicide",
    "burn",
    "acid",
    "emergency",
)

HIGH_SIGNALS = (
    "hit",
    "beating",
    "slap",
    "punch",
    "threaten",
    "threatened",
    "stalking",
    "forced",
    "abuse",
    "violence",
    "unsafe",
)

MEDIUM_SIGNALS = (
    "controlling",
    "shouting",
    "scared",
    "harassment",
    "blackmail",
    "pressure",
)


async def process_whatsapp_case_flow(
    phone_number: str,
    message: str,
    name: str | None = None,
    create_low_medium_cases: bool = True,
) -> dict[str, Any]:
    phone = normalize_phone_for_api(phone_number)
    if not phone:
        raise ValueError("phoneNumber is required.")

    risk_level, matched_signals = detect_risk_and_signals(message)
    full_name = _clean_name(name) or "Anonymous"
    care_seeker_payload = {
        "fullName": full_name,
        "phone": phone,
        "riskLevel": risk_level,
        "safetyNotes": _safety_notes(risk_level, matched_signals),
    }
    case_draft = build_case_draft(
        phone_number=phone,
        message=message,
        name=_clean_name(name),
        risk_level=risk_level,
        matched_signals=matched_signals,
    )

    if not nest_internal_client.enabled:
        return {
            "success": False,
            "error": "nest_internal_client_not_configured",
            "phoneNumber": phone,
            "riskLevel": risk_level,
            "matchedSignals": matched_signals,
            "careSeekerPayload": care_seeker_payload,
            "caseDraft": case_draft,
        }

    try:
        care_seeker = await _find_or_create_care_seeker(phone, full_name, care_seeker_payload)
        care_seeker_id = _extract_id(care_seeker)
        if not care_seeker_id:
            raise NestInternalClientError("Care seeker response did not include an id.")

        case_payload = {
            "careSeekerId": care_seeker_id,
            "title": case_draft["title"],
            "summary": case_draft["summary"],
            "incidentDescription": case_draft["incidentDescription"],
            "notes": case_draft["notes"],
            "status": "OPEN",
            "riskLevel": risk_level,
        }

        case_response = None
        case_action = "skipped"
        if create_low_medium_cases or risk_level in {"HIGH", "CRITICAL"}:
            case_response = await nest_internal_client.create_case(case_payload)
            case_action = "created"

        return {
            "success": True,
            "phoneNumber": phone,
            "careSeekerId": care_seeker_id,
            "caseId": _extract_id(case_response),
            "caseAction": case_action,
            "riskLevel": risk_level,
            "matchedSignals": matched_signals,
            "careSeekerPayload": care_seeker_payload,
            "casePayload": case_payload,
            "caseDraft": case_draft,
            "careSeekerResponse": care_seeker,
            "caseResponse": case_response,
        }
    except NestInternalClientError as exc:
        logger.warning("WhatsApp case flow failed: %s", exc)
        return {
            "success": False,
            "error": str(exc),
            "phoneNumber": phone,
            "riskLevel": risk_level,
            "matchedSignals": matched_signals,
            "careSeekerPayload": care_seeker_payload,
            "caseDraft": case_draft,
        }


async def _find_or_create_care_seeker(phone: str, full_name: str, payload: dict[str, Any]) -> Any:
    for lookup_phone in phone_lookup_variants(phone):
        existing = await nest_internal_client.get_care_seeker_by_phone(lookup_phone)
        if existing:
            existing_id = _extract_id(existing)
            existing_name = str(_extract_value(existing, "fullName") or "").strip()
            if existing_id and existing_name.lower() == "anonymous" and full_name != "Anonymous":
                await nest_internal_client.update_care_seeker(existing_id, {"fullName": full_name})
            return existing
    return await nest_internal_client.create_care_seeker(payload)


def detect_risk_and_signals(message: str) -> tuple[str, list[str]]:
    normalized = (message or "").lower()
    critical = _matched_signals(normalized, CRITICAL_SIGNALS)
    if critical:
        return "CRITICAL", critical
    high = _matched_signals(normalized, HIGH_SIGNALS)
    if high:
        return "HIGH", high
    medium = _matched_signals(normalized, MEDIUM_SIGNALS)
    if medium:
        return "MEDIUM", medium
    return "LOW", []


def _matched_signals(message: str, signals: tuple[str, ...]) -> list[str]:
    return [signal for signal in signals if signal in message]


def _clean_name(name: str | None) -> str | None:
    value = (name or "").strip()
    return value or None


def _safety_notes(risk_level: str, matched_signals: list[str]) -> str:
    matched = ", ".join(matched_signals) if matched_signals else "none"
    return f"Source: WhatsApp AI Service. Risk level: {risk_level}. Matched signals: {matched}."


def _extract_id(payload: Any) -> str | None:
    if not isinstance(payload, dict):
        return None
    for key in ("id", "caseId", "careSeekerId"):
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
    current = payload
    for part in key.split("."):
        if not isinstance(current, dict):
            return None
        current = current.get(part)
    if current is not None:
        return current
    data = payload.get("data")
    if isinstance(data, dict):
        return _extract_value(data, key)
    return None

