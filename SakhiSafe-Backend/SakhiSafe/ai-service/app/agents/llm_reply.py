import json
from typing import Any

from app.config import settings
from app.core.llm.safe_generate import SafeReplyResult, generate_safe_reply_result
from app.core.prompt_loader import render_prompt


GLOBAL_STYLE_RULES = """
Global response style:
- WhatsApp-friendly.
- Short.
- Calm.
- Supportive.
- No markdown tables.
- No long paragraphs.
- Ask at most one question.
- Do not sound robotic.
- Do not mention internal agent names.
- Do not mention risk score.
- Do not mention database, tools, or routing.

Critical safety rules:
1. Do not claim to be police, lawyer, doctor, therapist, or emergency responder.
2. Do not guarantee safety.
3. Do not guarantee legal outcomes.
4. Do not tell the user to confront the abuser.
5. Do not pressure the user to leave immediately unless there is immediate danger.
6. Do not invent helplines, NGOs, laws, shelters, or police contacts.
7. Do not send alerts directly from LLM text.
8. Tool execution must remain Python-only.
9. Do not include sensitive abuse details in notification-style text.
10. If immediate danger is possible, prioritize immediate safety and suggest contacting local emergency services or someone trusted.
"""


def generate_agent_reply(
    agent_name: str,
    fallback: str,
    latest_user_message: str,
    risk_level: str,
    recent_messages: list[dict[str, str]] | None = None,
    tool_result: dict[str, Any] | None = None,
    stealth_mode: bool = False,
    max_chars: int = 700,
) -> str:
    return generate_agent_reply_result(
        agent_name=agent_name,
        fallback=fallback,
        latest_user_message=latest_user_message,
        risk_level=risk_level,
        recent_messages=recent_messages,
        tool_result=tool_result,
        stealth_mode=stealth_mode,
        max_chars=max_chars,
    ).reply


def generate_agent_reply_result(
    agent_name: str,
    fallback: str,
    latest_user_message: str,
    risk_level: str,
    recent_messages: list[dict[str, str]] | None = None,
    tool_result: dict[str, Any] | None = None,
    stealth_mode: bool = False,
    max_chars: int = 700,
    previous_assistant_message: str | None = None,
    pending_question: str | None = None,
) -> SafeReplyResult:
    prompt = _build_prompt(
        agent_name=agent_name,
        latest_user_message=latest_user_message,
        risk_level=risk_level,
        recent_messages=recent_messages or [],
        tool_result=tool_result,
        stealth_mode=stealth_mode,
        previous_assistant_message=previous_assistant_message,
        pending_question=pending_question,
    )
    return generate_safe_reply_result(settings=settings, prompt=prompt, fallback=fallback, max_chars=max_chars)


def _build_prompt(
    agent_name: str,
    latest_user_message: str,
    risk_level: str,
    recent_messages: list[dict[str, str]],
    tool_result: dict[str, Any] | None,
    stealth_mode: bool,
    previous_assistant_message: str | None = None,
    pending_question: str | None = None,
) -> str:
    context = {
        "agent_name": agent_name,
        "latest_user_message": latest_user_message,
        "latest_message": latest_user_message,
        "recent_conversation_history": recent_messages[-10:],
        "conversation_history": json.dumps(recent_messages[-10:], ensure_ascii=False),
        "tool_result": tool_result,
        "risk_level": risk_level,
        "stealth_mode": stealth_mode,
        "sender_context": "none",
        "previous_assistant_message": previous_assistant_message or "none",
        "pending_question": pending_question or "none",
    }
    agent_instructions = render_prompt(
        f"{agent_name}.txt",
        {
            "latest_message": latest_user_message,
            "conversation_history": json.dumps(recent_messages[-10:], ensure_ascii=False),
            "risk_level": risk_level,
            "tool_result": json.dumps(tool_result, ensure_ascii=False) if tool_result else "none",
            "stealth_mode": str(stealth_mode).lower(),
            "sender_context": "none",
            "previous_assistant_message": previous_assistant_message or "none",
            "pending_question": pending_question or "none",
        },
    )
    return (
        f"{agent_instructions}\n\n{GLOBAL_STYLE_RULES}\n\n"
        "Write only the final WhatsApp reply text. No JSON. No markdown.\n\n"
        f"Context JSON:\n{json.dumps(context, ensure_ascii=False)}"
    )
