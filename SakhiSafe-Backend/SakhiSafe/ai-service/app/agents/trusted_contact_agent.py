import re

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.llm_reply import generate_agent_reply
from app.core.llm.safe_generate import LLM_TEMPORARY_UNAVAILABLE_REPLY
from app.tools.trusted_contact_tools import add_trusted_contact, create_alert_record, list_trusted_contacts


RELATIONSHIPS = ("sister", "brother", "mother", "father", "friend", "husband", "partner", "parent")


async def run(
    thread_id: str,
    sender_name: str | None,
    message_text: str,
    db: AsyncSession | None = None,
    user_id: int | None = None,
    recent_messages: list[dict[str, str]] | None = None,
) -> dict[str, str]:
    normalized_text = message_text.lower().strip()

    if _is_add_contact_request(normalized_text):
        if db is None or user_id is None:
            return _response(
                message_text=message_text,
                recent_messages=recent_messages,
                tool_result={"status": "storage_unavailable"},
            )

        phone = _extract_phone(message_text)
        if not phone:
            return _response(
                message_text=message_text,
                recent_messages=recent_messages,
                tool_result={"status": "missing_phone"},
            )

        relationship = _extract_relationship(normalized_text)
        name = relationship or "trusted contact"
        contact_id = await add_trusted_contact(
            db=db,
            user_id=user_id,
            name=name,
            phone=phone,
            relationship=relationship,
        )

        label = relationship or "trusted contact"
        return _response(
            message_text=message_text,
            recent_messages=recent_messages,
            tool_result={
                "status": "trusted_contact_saved",
                "contact_id": contact_id,
                "relationship": relationship,
                "label": label,
            },
        )

    if _is_alert_request(normalized_text):
        if db is None or user_id is None:
            return _response(
                risk_level="medium",
                message_text=message_text,
                recent_messages=recent_messages,
                tool_result={"status": "storage_unavailable"},
            )

        contacts = await list_trusted_contacts(db, user_id)
        if not contacts:
            return _response(
                message_text=message_text,
                recent_messages=recent_messages,
                tool_result={"status": "no_trusted_contact"},
            )

        alert_id = await create_alert_record(
            db=db,
            user_id=user_id,
            alert_type="trusted_contact",
            message="User requested a trusted contact alert.",
        )
        return _response(
            risk_level="high",
            message_text=message_text,
            recent_messages=recent_messages,
            tool_result={"status": "alert_prepared", "alert_id": alert_id},
        )

    return _response(
        message_text=message_text,
        recent_messages=recent_messages,
        tool_result={"status": "no_tool_action"},
    )


def _response(
    risk_level: str = "low",
    message_text: str = "",
    recent_messages: list[dict[str, str]] | None = None,
    tool_result: dict | None = None,
) -> dict[str, str]:
    return {
        "reply": generate_agent_reply(
            agent_name="trusted_contact_agent",
            fallback=LLM_TEMPORARY_UNAVAILABLE_REPLY,
            latest_user_message=message_text,
            recent_messages=recent_messages,
            risk_level=risk_level,
            tool_result=tool_result,
        ),
        "agent": "trusted_contact_agent",
        "risk_level": risk_level,
        "pending_intent": None,
        "pending_question": None,
    }


def _is_add_contact_request(message_text: str) -> bool:
    return "add" in message_text and ("trusted contact" in message_text or "emergency contact" in message_text or "contact" in message_text)


def _is_alert_request(message_text: str) -> bool:
    return any(keyword in message_text for keyword in ("alert", "send help", "call my sister", "message my sister"))


def _extract_phone(message_text: str) -> str | None:
    match = re.search(r"\+?\d[\d\s-]{7,}\d", message_text)
    if not match:
        return None

    return re.sub(r"\D", "", match.group(0))


def _extract_relationship(message_text: str) -> str | None:
    for relationship in RELATIONSHIPS:
        if relationship in message_text:
            return relationship
    return None
