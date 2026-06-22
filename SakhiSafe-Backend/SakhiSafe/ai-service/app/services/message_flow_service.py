import logging
from typing import Any

from app.core.phone import normalize_phone, phone_lookup_variants
from app.services.whatsapp_case_service import detect_risk_and_signals, process_whatsapp_case_flow


logger = logging.getLogger("sakhi-ai-service.message_flow")

SAFE_SAVE_FALLBACK_RESPONSE = (
    "I'm here with you. I'm having trouble saving this right now, but your safety matters. "
    "Are you safe at this moment?"
)

ANONYMOUS_NAME_PROMPT = "You can share your name if you're comfortable, but you can also continue anonymously."

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

INCIDENT_LOG_SIGNALS = (
    "log",
    "log my incident",
    "log incident",
    "log it",
    "save",
    "save incident",
    "save it",
    "create incident",
    "record",
    "record incident",
    "record it",
    "document",
    "document incident",
    "document it",
    "save this",
    "record this",
    "document this",
    "log this",
)


async def process_care_seeker_message(payload: dict[str, Any]) -> dict[str, Any]:
    phone_number = normalize_phone(str(payload.get("phoneNumber") or ""))
    if not phone_number:
        raise ValueError("phoneNumber is required.")

    message = str(payload.get("message") or "").strip()
    metadata = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}
    display_name = _display_name(payload.get("name"))
    risk_level, matched_signals = detect_risk_and_signals(message)
    response = _safe_response_for_risk(risk_level)
    name_prompt = None if payload.get("name") or metadata.get("namePrompted") else ANONYMOUS_NAME_PROMPT

    flow_result = await process_whatsapp_case_flow(
        phone_number=phone_number,
        message=message,
        name=payload.get("name") if payload.get("name") else None,
        create_low_medium_cases=True,
    )
    case_synced = bool(flow_result["success"])
    if not case_synced and (risk_level in {"HIGH", "CRITICAL"} or is_incident_log_request(message)):
        response = SAFE_SAVE_FALLBACK_RESPONSE

    if name_prompt and response != SAFE_SAVE_FALLBACK_RESPONSE:
        response = f"{response} {name_prompt}"

    return {
        "displayName": display_name,
        "riskLevel": risk_level,
        "matchedSignals": matched_signals,
        "caseSynced": case_synced,
        "careSeekerId": flow_result.get("careSeekerId"),
        "caseId": flow_result.get("caseId"),
        "caseDraft": flow_result["caseDraft"],
        "casePayload": flow_result.get("casePayload"),
        "finalResponse": response,
    }


def detect_risk_level(message: str) -> str:
    risk_level, _ = detect_risk_and_signals(message)
    return risk_level


def is_incident_log_request(message: str) -> bool:
    return _contains_any(message.lower(), INCIDENT_LOG_SIGNALS)


def _display_name(name: Any) -> str:
    value = str(name or "").strip()
    return value or "Anonymous"


def _safe_response_for_risk(risk_level: str) -> str:
    if risk_level == "CRITICAL":
        return "I'm here with you. If you are in immediate danger, move toward a safer place and contact emergency help or someone trusted now."
    if risk_level == "HIGH":
        return "I'm here with you. That sounds unsafe, and your safety matters. Are you safe at this moment?"
    if risk_level == "MEDIUM":
        return "I'm here with you. What happened is important, and we can take this one step at a time."
    return "I'm here with you. You can tell me what happened at your pace."


def _summary(message: str) -> str:
    cleaned = " ".join(message.split())
    if len(cleaned) <= 160:
        return cleaned
    return f"{cleaned[:157].rstrip()}..."


def _contains_any(message: str, signals: tuple[str, ...]) -> bool:
    return any(signal in message for signal in signals)
