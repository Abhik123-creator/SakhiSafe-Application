from app.agents.llm_reply import generate_agent_reply_result
from app.core.crisis_detector import detect_crisis_signals
from app.core.llm.safe_generate import LLM_TEMPORARY_UNAVAILABLE_REPLY


CRISIS_QUESTIONS = {
    "confirm_abuser_nearby",
    "confirm_current_safety",
    "confirm_has_trusted_person",
}


def run(
    thread_id: str,
    sender_name: str | None,
    message_text: str,
    recent_messages: list[dict[str, str]] | None = None,
    previous_assistant_message: str | None = None,
    pending_question: str | None = None,
    crisis_stage: str | None = None,
    crisis_context: dict | None = None,
) -> dict[str, object]:
    crisis_signals = detect_crisis_signals(message_text)
    merged_context = _merge_crisis_context(crisis_context, crisis_signals)
    next_state = _next_crisis_state(crisis_signals, pending_question)
    llm_result = generate_agent_reply_result(
        agent_name="crisis_agent",
        fallback=LLM_TEMPORARY_UNAVAILABLE_REPLY,
        latest_user_message=message_text,
        recent_messages=recent_messages,
        risk_level=crisis_signals["risk_level"],
        previous_assistant_message=previous_assistant_message,
        pending_question=pending_question,
    )

    return {
        "reply": llm_result.reply,
        "agent": "crisis_agent",
        "risk_level": crisis_signals["risk_level"],
        "pending_intent": next_state["pending_intent"],
        "pending_question": next_state["pending_question"],
        "crisis_stage": next_state["crisis_stage"],
        "crisis_context": merged_context,
        "llm_agent_error": llm_result.error,
        "used_agent_fallback": False,
        "used_crisis_playbook": False,
        "used_llm_rewrite": False,
        "generated_reply_length": len(llm_result.reply),
    }


def _next_crisis_state(crisis_signals: dict, pending_question: str | None) -> dict[str, str | None]:
    if pending_question == "confirm_has_trusted_person":
        return {
            "pending_intent": "trusted_contact_agent",
            "pending_question": "confirm_has_trusted_person",
            "crisis_stage": "trusted_contact_offer",
        }

    if crisis_signals.get("says_abuser_not_nearby"):
        return {
            "pending_intent": "trusted_contact_agent",
            "pending_question": "confirm_has_trusted_person",
            "crisis_stage": "safe_now_planning",
        }

    if crisis_signals.get("asks_escape_plan"):
        return {
            "pending_intent": "crisis_agent",
            "pending_question": "confirm_has_trusted_person",
            "crisis_stage": "safe_now_planning",
        }

    return {
        "pending_intent": "crisis_agent",
        "pending_question": "confirm_abuser_nearby",
        "crisis_stage": "safety_check",
    }


def _merge_crisis_context(existing_context: dict | None, crisis_signals: dict) -> dict:
    context = {
        "reported_rape": False,
        "reported_physical_assault": False,
        "reported_burn": False,
        "abuser_nearby": None,
        "user_safe_to_chat": None,
        "needs_escape_plan": False,
    }
    if existing_context:
        context.update(existing_context)

    for key in ("reported_rape", "reported_physical_assault", "reported_burn"):
        context[key] = bool(context.get(key) or crisis_signals.get(key))

    if crisis_signals.get("says_abuser_not_nearby"):
        context["abuser_nearby"] = False
    elif crisis_signals.get("says_abuser_nearby"):
        context["abuser_nearby"] = True

    if crisis_signals.get("asks_escape_plan"):
        context["needs_escape_plan"] = True

    return context
