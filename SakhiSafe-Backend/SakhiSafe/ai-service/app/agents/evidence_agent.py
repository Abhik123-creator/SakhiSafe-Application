import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.llm_reply import generate_agent_reply
from app.core.simple_extractors import extract_location, extract_relative_date
from app.core.llm.safe_generate import LLM_TEMPORARY_UNAVAILABLE_REPLY
from app.services.backend_sync_service import fetch_cases_for_user
from app.tools.evidence_tools import create_incident, get_latest_incident, list_incidents, update_latest_incident


logger = logging.getLogger("sakhi-ai-service.agents.evidence")

CREATE_KEYWORDS = (
    "save",
    "record",
    "document",
    "log",
    "create incident",
    "save incident",
    "log incident",
    "record incident",
    "document incident",
)
LIST_KEYWORDS = (
    "show incidents",
    "show all incidents",
    "list incidents",
    "show my incidents",
    "incidents i logged",
    "incidents logged",
    "already logged",
    "saved incidents",
    "previous incidents",
    "incident history",
    "show records",
    "show my saved records",
    "list records",
    "fetch logged incident",
    "fetch logged incidents",
    "fetch incidents",
    "fetch my incidents",
    "get logged incident",
    "get logged incidents",
    "what have i saved",
)
DETAIL_KEYWORDS = ("show latest incident", "show last incident", "details of incident", "open incident")
UPDATE_ACTION_WORDS = ("add", "update", "change", "attach")
UPDATE_TARGET_WORDS = ("date", "time", "location", "details", "note", "witness", "photo", "screenshot", "evidence")


async def run(
    thread_id: str,
    sender_name: str | None,
    message_text: str,
    db: AsyncSession | None = None,
    user_id: int | None = None,
    source_message_id: str | None = None,
    recent_messages: list[dict[str, str]] | None = None,
) -> dict[str, str]:
    normalized_text = message_text.lower().strip()
    intent = classify_evidence_intent(normalized_text)
    logger.info("Evidence agent intent=%s tool_available=%s", intent, bool(db and user_id))

    if db is None or user_id is None:
        return _reply(
            message_text=message_text,
            recent_messages=recent_messages,
            risk_level="low",
            tool_result={"status": "storage_unavailable", "intent": intent},
        )

    if intent == "list_incidents":
        incidents = await list_incidents(db, user_id=user_id, limit=10)
        backend_cases = await fetch_cases_for_user(db, user_id)
        logger.info("Evidence tool=list_incidents success=true count=%s", len(incidents))
        return _reply(
            message_text=message_text,
            recent_messages=recent_messages,
            risk_level="low",
            tool_result={
                "status": "incidents_listed",
                "count": len(incidents),
                "incidents": [_incident_summary(incident) for incident in incidents],
                "backend_cases": backend_cases,
            },
        )

    if intent == "show_latest_incident":
        incident = await get_latest_incident(db, user_id=user_id)
        logger.info("Evidence tool=get_latest_incident success=%s", incident is not None)
        return _reply(
            message_text=message_text,
            recent_messages=recent_messages,
            risk_level=incident.severity if incident else "low",
            tool_result={
                "status": "latest_incident_shown" if incident else "no_incident_found",
                "incident": _incident_summary(incident) if incident else None,
            },
        )

    if intent == "update_latest_incident":
        incident_date = extract_relative_date(message_text)
        location = extract_location(message_text)
        additional_note = _extract_additional_note(message_text, incident_date=incident_date, location=location)
        update_result = await update_latest_incident(
            db=db,
            user_id=user_id,
            incident_date=incident_date,
            location=location,
            additional_note=additional_note,
        )
        logger.info("Evidence tool=update_latest_incident success=%s", update_result["success"])
        if not update_result["success"]:
            risk_level = "low"
            updated_fields = []
            incident_summary = None
        else:
            updated_fields = update_result.get("updated_fields", [])
            incident_summary = _incident_summary(update_result["incident"])
            risk_level = update_result["incident"].severity
        return _reply(
            message_text=message_text,
            recent_messages=recent_messages,
            risk_level=risk_level,
            tool_result={
                "status": "latest_incident_updated" if update_result["success"] else "no_incident_found",
                "updated_fields": updated_fields,
                "incident": incident_summary,
            },
        )

    if intent == "ask_for_missing_details":
        previous_message = _previous_user_message(recent_messages, message_text)
        if _is_reference_create_request(normalized_text):
            description = previous_message or _fallback_incident_description(message_text)
            incident_type, severity = _classify_incident(description.lower().strip())
            incident_id = await create_incident(
                db=db,
                user_id=user_id,
                incident_type=incident_type,
                severity=severity,
                description=description,
                source_message_id=source_message_id,
            )
            logger.info("Evidence tool=create_incident_from_context success=true incident_id=%s", incident_id)
            return _reply(
                message_text=message_text,
                recent_messages=recent_messages,
                risk_level=severity,
                tool_result={
                    "status": "incident_saved",
                    "incident_id": incident_id,
                    "incident_type": incident_type,
                    "severity": severity,
                    "source": "previous_message" if previous_message else "minimal_details",
                },
            )

        return _reply(
            message_text=message_text,
            recent_messages=recent_messages,
            risk_level="low",
            tool_result={"status": "needs_more_detail"},
        )

    incident_type, severity = _classify_incident(normalized_text)
    incident_id = await create_incident(
        db=db,
        user_id=user_id,
        incident_type=incident_type,
        severity=severity,
        description=message_text,
        source_message_id=source_message_id,
    )
    logger.info("Evidence tool=create_incident success=true incident_id=%s", incident_id)
    return _reply(
        message_text=message_text,
        recent_messages=recent_messages,
        risk_level=severity,
        tool_result={
            "status": "incident_saved",
            "incident_id": incident_id,
            "incident_type": incident_type,
            "severity": severity,
        },
    )


def classify_evidence_intent(message_text: str) -> str:
    if _contains_any(message_text, LIST_KEYWORDS):
        return "list_incidents"

    if _contains_any(message_text, DETAIL_KEYWORDS):
        return "show_latest_incident"

    if _contains_any(message_text, UPDATE_ACTION_WORDS) and _contains_any(message_text, UPDATE_TARGET_WORDS):
        return "update_latest_incident"

    if _contains_any(message_text, CREATE_KEYWORDS):
        description = _strip_create_trigger(message_text)
        return "create_incident" if description else "ask_for_missing_details"

    return "ask_for_missing_details"


def _reply(
    message_text: str,
    recent_messages: list[dict[str, str]] | None,
    risk_level: str,
    tool_result: dict,
) -> dict[str, str]:
    return {
        "reply": generate_agent_reply(
            agent_name="evidence_agent",
            fallback=LLM_TEMPORARY_UNAVAILABLE_REPLY,
            latest_user_message=message_text,
            recent_messages=recent_messages,
            risk_level=risk_level,
            tool_result=tool_result,
        ),
        "agent": "evidence_agent",
        "risk_level": risk_level,
        "pending_intent": None,
        "pending_question": None,
    }


def _strip_create_trigger(message_text: str) -> str:
    normalized_text = message_text.lower().strip()
    for trigger in (
        "save",
        "save this",
        "save it",
        "record",
        "record this",
        "record it",
        "document",
        "document this",
        "document it",
        "log",
        "log this",
        "log it",
        "log my incident",
        "record my incident",
        "document my incident",
        "create incident",
        "save incident",
        "log incident",
        "record incident",
        "document incident",
    ):
        if normalized_text == trigger:
            return ""
        if normalized_text.startswith(trigger):
            return message_text[len(trigger) :].strip()
    return message_text.strip()


def _is_reference_create_request(message_text: str) -> bool:
    return message_text in {"save", "save it", "record", "record it", "document", "document it", "log", "log it"}


def _fallback_incident_description(message_text: str) -> str:
    return f"User asked to record an incident without additional details. Request text: {message_text.strip()}"


def _previous_user_message(recent_messages: list[dict[str, str]] | None, current_message: str) -> str | None:
    if not recent_messages:
        return None

    normalized_current = current_message.strip()
    for item in reversed(recent_messages):
        if item.get("role") != "user":
            continue
        content = (item.get("content") or "").strip()
        if content and content != normalized_current:
            return content
    return None


def _extract_additional_note(message_text: str, incident_date: str | None, location: str | None) -> str | None:
    normalized_text = message_text.lower()
    if any(word in normalized_text for word in ("details", "note", "more info", "witness")):
        return message_text.strip()
    if not incident_date and not location:
        return message_text.strip()
    return None


def _incident_summary(incident) -> dict:
    return {
        "incident_type": incident.incident_type,
        "severity": incident.severity,
        "incident_date": incident.incident_date,
        "incident_time": incident.incident_time,
        "location": incident.location,
        "created_at": incident.created_at.isoformat() if incident.created_at else None,
    }


def _classify_incident(message_text: str) -> tuple[str, str]:
    if _contains_any(message_text, ("hit", "slap", "slapped", "beat", "hurt", "bleeding")):
        return "physical", "high"

    if _contains_any(message_text, ("rape", "sexual", "molest", "forced sex", "touched me")):
        return "sexual", "critical"

    if _contains_any(message_text, ("threat", "kill", "harm")):
        return "threat", "critical"

    if _contains_any(message_text, ("stalking", "follows")):
        return "stalking", "high"

    if _contains_any(message_text, ("phone", "password", "tracking")):
        return "digital", "medium"

    if _contains_any(message_text, ("money", "salary", "bank", "financial")):
        return "financial", "medium"

    if _contains_any(message_text, ("insult", "abuse", "gaslight", "control")):
        return "emotional", "medium"

    return "other", "low"


def _contains_any(message_text: str, keywords: tuple[str, ...]) -> bool:
    return any(keyword in message_text for keyword in keywords)
