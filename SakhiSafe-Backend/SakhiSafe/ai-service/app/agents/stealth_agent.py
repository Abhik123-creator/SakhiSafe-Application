from app.agents.llm_reply import generate_agent_reply
from app.core.llm.safe_generate import LLM_TEMPORARY_UNAVAILABLE_REPLY


def run(
    thread_id: str,
    sender_name: str | None,
    message_text: str,
    recent_messages: list[dict[str, str]] | None = None,
) -> dict[str, str]:
    return {
        "reply": generate_agent_reply(
            agent_name="stealth_agent",
            fallback=LLM_TEMPORARY_UNAVAILABLE_REPLY,
            latest_user_message=message_text,
            recent_messages=recent_messages,
            risk_level="low",
            stealth_mode=True,
            max_chars=250,
        ),
        "agent": "stealth_agent",
        "risk_level": "low",
        "pending_intent": "stealth_agent",
        "pending_question": "confirm_stealth_mode",
    }
