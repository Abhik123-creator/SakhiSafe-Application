import json
import logging
from typing import Any

from app.config import settings
from app.core.crisis_detector import detect_crisis_signals
from app.core.llm.factory import get_llm_client
from app.core.prompt_loader import render_prompt


logger = logging.getLogger("sakhi-ai-service.supervisor")

ALLOWED_AGENTS = {
    "crisis_agent",
    "abuse_pattern_agent",
    "safety_planning_agent",
    "evidence_agent",
    "trusted_contact_agent",
    "stealth_agent",
    "general_agent",
}

ALLOWED_RISK_LEVELS = {"low", "medium", "high", "critical"}

CRISIS_KEYWORDS = (
    "help",
    "danger",
    "emergency",
    "hit",
    "hit me",
    "slapped",
    "beat",
    "kill",
    "threat",
    "scared",
    "trapped",
    "bleeding",
    "hurt",
    "unsafe",
    "sexually abuse",
    "sexual abuse",
    "forced sex",
    "rape",
    "raped",
    "molest",
    "touched me",
    "sexual assault",
    "forced me",
    "marital rape",
    "burned me",
    "cigarette",
    "attacked me",
    "threatened me",
)

CRISIS_PHYSICAL_KEYWORDS = (
    "hit",
    "hit me",
    "burn",
    "burned",
    "burned me",
    "cigarette",
    "attacked",
    "bleeding",
    "hurt",
)

CRISIS_FOLLOW_UP_KEYWORDS = (
    "yes",
    "no",
    "help",
    "help me",
    "what to do",
    "tell me",
    "give me answer",
    "please",
    "ok",
    "okay",
)

ABUSE_PATTERN_KEYWORDS = (
    "abuse",
    "control",
    "gaslight",
    "checks my phone",
    "not allowed",
    "force",
    "insult",
    "isolate",
    "follows me",
    "stalking",
)

SAFETY_PLANNING_KEYWORDS = (
    "leave",
    "escape",
    "safety plan",
    "safe place",
    "documents",
    "where can i go",
    "run away",
)

EVIDENCE_CREATE_KEYWORDS = (
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
)

EVIDENCE_UPDATE_KEYWORDS = (
    "add date",
    "add time",
    "add location",
    "update incident",
    "update this",
    "add to this incident",
    "add this to previous incident",
    "add details",
    "add note",
    "add more info",
    "add photo",
    "add screenshot",
    "attach evidence",
    "add witness",
    "change date",
    "change location",
)

EVIDENCE_LIST_KEYWORDS = (
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

EVIDENCE_DETAIL_KEYWORDS = (
    "show latest incident",
    "show last incident",
    "details of incident",
    "open incident",
)

EVIDENCE_KEYWORDS = (
    *EVIDENCE_CREATE_KEYWORDS,
    *EVIDENCE_UPDATE_KEYWORDS,
    *EVIDENCE_LIST_KEYWORDS,
    *EVIDENCE_DETAIL_KEYWORDS,
    "evidence",
    "screenshot",
    "photo",
    "proof",
)

STEALTH_KEYWORDS = (
    "hide",
    "stealth",
    "clear chat",
    "weather mode",
    "delete chat",
    "fake mode",
)

TRUSTED_CONTACT_KEYWORDS = (
    "trusted contact",
    "alert",
    "call my sister",
    "message my sister",
    "add my sister",
    "add contact",
    "emergency contact",
    "send help",
)


def select_agent(
    message_text: str,
    recent_messages: list[dict[str, str]] | None = None,
    thread_id: str | None = None,
    sender_name: str | None = None,
) -> str:
    return route_message(
        message_text=message_text,
        recent_messages=recent_messages,
        thread_id=thread_id,
        sender_name=sender_name,
    )["agent"]


def route_message(
    message_text: str,
    recent_messages: list[dict[str, str]] | None = None,
    thread_id: str | None = None,
    sender_name: str | None = None,
    previous_assistant_message: str | None = None,
    pending_state: dict[str, Any] | None = None,
) -> dict[str, Any]:
    crisis_signals = detect_crisis_signals(message_text)
    if crisis_signals["is_crisis"]:
        decision = _decision("crisis_agent", crisis_signals["risk_level"], "Crisis detector forced crisis route.")
        decision["crisis_signals"] = crisis_signals
        logger.info("Crisis detector route selected agent=crisis_agent risk_level=%s", crisis_signals["risk_level"])
        return decision

    deterministic_decision = _deterministic_safety_route(message_text, pending_state)
    if deterministic_decision:
        logger.info(
            "Deterministic safety route selected agent=%s risk_level=%s",
            deterministic_decision["agent"],
            deterministic_decision["risk_level"],
        )
        return deterministic_decision

    deterministic_decision = _deterministic_tool_route(message_text)
    if deterministic_decision:
        logger.info(
            "Deterministic tool route selected agent=%s risk_level=%s",
            deterministic_decision["agent"],
            deterministic_decision["risk_level"],
        )
        return deterministic_decision

    if settings.enable_llm_supervisor:
        decision, error = _try_llm_supervisor(
            message_text=message_text,
            recent_messages=recent_messages or [],
            thread_id=thread_id,
            sender_name=sender_name,
            previous_assistant_message=previous_assistant_message,
            pending_state=pending_state,
        )
        if decision:
            logger.info("LLM supervisor routed agent=%s risk_level=%s", decision["agent"], decision["risk_level"])
            return decision
    else:
        error = None

    decision = keyword_route_message(message_text)
    if error:
        decision["llm_supervisor_error"] = error
    logger.info("Keyword supervisor routed agent=%s risk_level=%s", decision["agent"], decision["risk_level"])
    return decision


def _deterministic_safety_route(message_text: str, pending_state: dict[str, Any] | None = None) -> dict[str, Any] | None:
    normalized_text = message_text.lower().strip()
    pending_state = pending_state or {}

    if pending_state.get("last_agent") == "crisis_agent" and _is_crisis_follow_up(normalized_text):
        return _decision("crisis_agent", "critical", "Continuing crisis follow-up.")

    if _contains_keyword(normalized_text, CRISIS_KEYWORDS):
        return _decision("crisis_agent", _crisis_risk(normalized_text), "Possible immediate crisis or recent harm.")

    return None


def _deterministic_tool_route(message_text: str) -> dict[str, Any] | None:
    normalized_text = message_text.lower()

    if _contains_keyword(normalized_text, EVIDENCE_KEYWORDS):
        return _decision("evidence_agent", _evidence_risk(normalized_text), "User explicitly requested incident management.")

    if _contains_keyword(normalized_text, TRUSTED_CONTACT_KEYWORDS):
        return _decision("trusted_contact_agent", "medium", "User explicitly requested trusted contact or alert workflow.")

    return None


def keyword_route_message(message_text: str) -> dict[str, Any]:
    normalized_text = message_text.lower()
    crisis_signals = detect_crisis_signals(message_text)

    if crisis_signals["is_crisis"]:
        decision = _decision("crisis_agent", crisis_signals["risk_level"], "Crisis detector forced crisis route.")
        decision["crisis_signals"] = crisis_signals
        return decision

    if _contains_keyword(normalized_text, EVIDENCE_KEYWORDS):
        return _decision("evidence_agent", _evidence_risk(normalized_text), "User asked for incident or evidence management.")

    if _contains_keyword(normalized_text, TRUSTED_CONTACT_KEYWORDS):
        return _decision("trusted_contact_agent", "medium", "User requested trusted contact or alert workflow.")

    if _contains_keyword(normalized_text, CRISIS_KEYWORDS):
        return _decision("crisis_agent", _crisis_risk(normalized_text), "Possible immediate safety concern.")

    if _contains_keyword(normalized_text, ABUSE_PATTERN_KEYWORDS):
        return _decision("abuse_pattern_agent", "medium", "User described possible abusive or controlling behavior.")

    if _contains_keyword(normalized_text, SAFETY_PLANNING_KEYWORDS):
        return _decision("safety_planning_agent", "medium", "User asked for safety planning.")

    if _contains_keyword(normalized_text, STEALTH_KEYWORDS):
        return _decision("stealth_agent", "low", "User asked for privacy or stealth mode.")

    return _decision("general_agent", "low", "General or unclear message.")


def _try_llm_supervisor(
    message_text: str,
    recent_messages: list[dict[str, str]],
    thread_id: str | None,
    sender_name: str | None,
    previous_assistant_message: str | None,
    pending_state: dict[str, Any] | None,
) -> tuple[dict[str, Any] | None, str | None]:
    try:
        client = get_llm_client(settings)
    except Exception as exc:
        logger.warning("LLM supervisor client initialization failed. Falling back to keyword supervisor. error=%s", type(exc).__name__)
        return None, type(exc).__name__

    if client is None:
        logger.warning("LLM supervisor enabled but no supported client is configured. Falling back to keyword supervisor.")
        return None, "llm_client_unavailable"

    prompt = _build_supervisor_prompt(
        message_text=message_text,
        recent_messages=recent_messages,
        thread_id=thread_id,
        sender_name=sender_name,
        previous_assistant_message=previous_assistant_message,
        pending_state=pending_state,
    )

    try:
        result = client.generate_json(
            prompt,
            temperature=settings.llm_supervisor_temperature,
            max_output_tokens=settings.llm_max_output_tokens,
            thinking_budget=settings.llm_thinking_budget,
        )
        decision = _validate_decision(result)
        decision["supervisor_source"] = "llm"
        return decision, None
    except Exception as exc:
        logger.warning("LLM supervisor failed. Falling back to keyword supervisor. error=%s", type(exc).__name__)
        return None, type(exc).__name__


def _build_supervisor_prompt(
    message_text: str,
    recent_messages: list[dict[str, str]],
    thread_id: str | None,
    sender_name: str | None,
    previous_assistant_message: str | None,
    pending_state: dict[str, Any] | None,
) -> str:
    context = {
        "sender_phone": thread_id,
        "sender_name": sender_name,
        "latest_user_message": message_text,
        "latest_message": message_text,
        "recent_messages": recent_messages[-10:],
        "previous_assistant_message": previous_assistant_message,
        "pending_state": pending_state or {},
        "conversation_history": json.dumps(recent_messages[-10:], ensure_ascii=False),
        "risk_level": "none",
        "tool_result": "none",
        "stealth_mode": "none",
        "sender_context": json.dumps(
            {"sender_phone": thread_id, "sender_name": sender_name},
            ensure_ascii=False,
        ),
    }
    instructions = render_prompt(
        "supervisor.txt",
        {
            "latest_message": message_text,
            "conversation_history": json.dumps(recent_messages[-10:], ensure_ascii=False),
            "risk_level": "none",
            "tool_result": "none",
            "stealth_mode": "none",
            "sender_context": context["sender_context"],
            "previous_assistant_message": previous_assistant_message or "none",
            "pending_state": json.dumps(pending_state or {}, ensure_ascii=False),
        },
    )
    return f"{instructions}\n\nConversation context JSON:\n{json.dumps(context, ensure_ascii=False)}"


def _validate_decision(result: dict[str, Any]) -> dict[str, Any]:
    agent = result.get("agent")
    risk_level = result.get("risk_level")
    reason = result.get("reason") or "LLM supervisor route."
    direct_response = result.get("direct_response")

    if agent not in ALLOWED_AGENTS:
        raise ValueError("Invalid supervisor agent.")

    if risk_level not in ALLOWED_RISK_LEVELS:
        raise ValueError("Invalid supervisor risk_level.")

    if direct_response is not None:
        raise ValueError("Supervisor direct_response must be null for this phase.")

    return {
        "agent": agent,
        "risk_level": risk_level,
        "reason": str(reason)[:200],
        "direct_response": None,
    }


def _decision(agent: str, risk_level: str, reason: str) -> dict[str, Any]:
    return {
        "agent": agent,
        "risk_level": risk_level,
        "reason": reason,
        "direct_response": None,
        "supervisor_source": "keyword_fallback",
    }


def _contains_keyword(message_text: str, keywords: tuple[str, ...]) -> bool:
    return any(keyword in message_text for keyword in keywords)


def _evidence_risk(message_text: str) -> str:
    if _contains_keyword(message_text, CRISIS_KEYWORDS):
        return "medium"
    return "low"


def _crisis_risk(message_text: str) -> str:
    if ("rape" in message_text or "raped" in message_text) and _contains_keyword(message_text, CRISIS_PHYSICAL_KEYWORDS):
        return "critical"
    if _contains_keyword(message_text, ("rape", "raped", "sexual assault", "forced sex", "bleeding", "cigarette")):
        return "critical"
    return "high"


def _is_crisis_follow_up(message_text: str) -> bool:
    if len(message_text.split()) <= 4 and _contains_keyword(message_text, CRISIS_FOLLOW_UP_KEYWORDS):
        return True
    return any(phrase in message_text for phrase in ("help me what to do", "give me answer what to do", "what to do"))
