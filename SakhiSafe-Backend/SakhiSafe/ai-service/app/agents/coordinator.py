from typing import Any, Literal

from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents import (
    abuse_pattern_agent,
    crisis_agent,
    evidence_agent,
    general_agent,
    safety_planning_agent,
    stealth_agent,
    trusted_contact_agent,
)
from app.agents.supervisor import route_message
from app.config import settings
from app.core.conversation_intent import resolve_pending_intent
from app.agents.crisis_agent import CRISIS_QUESTIONS
from app.core.crisis_detector import detect_crisis_signals
from app.db.models import Conversation
from app.services.conversation_service import clear_pending_intent


RiskLevel = Literal["low", "medium", "high", "critical"]


class Sender(BaseModel):
    id: str = Field(..., min_length=1)
    name: str | None = None
    platform_metadata: dict[str, Any] = Field(default_factory=dict)


class Message(BaseModel):
    text: str | None = None
    type: str = Field(..., min_length=1)
    button_id: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class NormalizedMessageRequest(BaseModel):
    source: Literal["whatsapp"]
    message_id: str = Field(..., min_length=1)
    timestamp: int | None = None
    sender: Sender
    message: Message
    media: dict[str, Any] | None = None
    raw: dict[str, Any] = Field(default_factory=dict)


class MessagingResponse(BaseModel):
    status: Literal["success"]
    received: bool
    is_json: bool
    response: str
    agent: str
    risk_level: RiskLevel
    debug: dict[str, Any] | None = None


async def handle_message(payload: NormalizedMessageRequest) -> MessagingResponse:
    agent_result = await process_agent_message(
        thread_id=payload.sender.id,
        sender_name=payload.sender.name,
        message_text=payload.message.text or "",
    )

    return MessagingResponse(
        status="success",
        received=True,
        is_json=True,
        response=agent_result["reply"],
        agent=agent_result["agent"],
        risk_level=agent_result["risk_level"],
    )


async def process_agent_message(
    thread_id: str,
    sender_name: str | None,
    message_text: str,
    recent_messages: list[dict[str, str]] | None = None,
    db: AsyncSession | None = None,
    user_id: int | None = None,
    source_message_id: str | None = None,
    conversation: Conversation | None = None,
    previous_assistant_message: str | None = None,
    sender_context: dict[str, str | None] | None = None,
) -> dict[str, str]:
    pending_intent_before = conversation.pending_intent if conversation else None
    pending_question_before = conversation.pending_question if conversation else None
    crisis_stage_before = conversation.crisis_stage if conversation else None
    crisis_context_before = conversation.crisis_context_json if conversation else None
    crisis_signals = detect_crisis_signals(message_text)
    debug = {
        "llm_supervisor_enabled": settings.enable_llm_supervisor,
        "llm_agent_responses_enabled": settings.enable_llm_agent_responses,
        "supervisor_source": None,
        "selected_agent": None,
        "risk_level": None,
        "llm_supervisor_error": None,
        "llm_agent_error": None,
        "used_agent_fallback": None,
        "history_count": len(recent_messages or []),
        "latest_user_message": message_text,
        "previous_assistant_message": previous_assistant_message,
        "pending_intent_before": pending_intent_before,
        "pending_question_before": pending_question_before,
        "pending_intent_after": None,
        "crisis_signals": crisis_signals,
        "crisis_stage_before": crisis_stage_before,
        "crisis_stage_after": None,
        "used_crisis_playbook": False,
        "used_llm_rewrite": False,
        "was_trimmed": False,
        "generated_reply_length": 0,
        "final_reply_length": 0,
    }

    has_crisis_pending = (
        conversation is not None
        and conversation.last_agent == "crisis_agent"
        and conversation.pending_question in CRISIS_QUESTIONS
    )
    crisis_pending = has_crisis_pending and _should_continue_crisis_pending(message_text, crisis_signals)
    if has_crisis_pending and not crisis_pending and db is not None and conversation is not None:
        await clear_pending_intent(db, conversation.id)
        conversation.pending_intent = None
        conversation.pending_question = None

    pending_resolution = None if crisis_pending else (resolve_pending_intent(conversation, message_text) if conversation else None)
    if pending_resolution and pending_resolution["action"] == "cancel":
        if db is not None and conversation is not None:
            await clear_pending_intent(db, conversation.id)
        cancel_result = general_agent.run(
            thread_id=thread_id,
            sender_name=sender_name,
            message_text=message_text,
            recent_messages=recent_messages,
        )
        return {
            "reply": cancel_result["reply"],
            "agent": cancel_result["agent"],
            "risk_level": cancel_result["risk_level"],
            "intent": "Cancelled pending follow-up.",
            "pending_intent": None,
            "pending_question": None,
            "debug": {
                **debug,
                "supervisor_source": "pending_intent",
                "selected_agent": cancel_result["agent"],
                "risk_level": cancel_result["risk_level"],
                "pending_intent_after": None,
            },
        }

    if crisis_pending:
        selected_agent = "crisis_agent"
        supervisor_decision = {
            "agent": selected_agent,
            "risk_level": "critical",
            "reason": "Continuing current-safety crisis follow-up.",
            "supervisor_source": "pending_intent",
        }
        if db is not None and conversation is not None:
            await clear_pending_intent(db, conversation.id)
    elif pending_resolution and pending_resolution["action"] == "route":
        selected_agent = pending_resolution["agent"]
        supervisor_decision = {
            "agent": selected_agent,
            "risk_level": (conversation.last_risk_level if conversation else None) or "medium",
            "reason": f"Resolved pending intent: {pending_resolution.get('pending_question') or selected_agent}.",
            "supervisor_source": "pending_intent",
        }
        if db is not None and conversation is not None:
            await clear_pending_intent(db, conversation.id)
    else:
        pending_state = None
        if conversation is not None:
            pending_state = {
                "pending_intent": conversation.pending_intent,
                "pending_question": conversation.pending_question,
                "pending_payload": conversation.pending_payload_json,
                "last_agent": conversation.last_agent,
                "last_risk_level": conversation.last_risk_level,
                "crisis_stage": conversation.crisis_stage,
                "crisis_context": conversation.crisis_context_json,
            }
        supervisor_decision = route_message(
            message_text=message_text,
            recent_messages=recent_messages,
            thread_id=thread_id,
            sender_name=sender_name,
            previous_assistant_message=previous_assistant_message,
            pending_state=pending_state,
        )
        selected_agent = supervisor_decision["agent"]

    agent = _AGENTS.get(selected_agent, general_agent)
    debug.update(
        {
            "supervisor_source": supervisor_decision.get("supervisor_source"),
            "selected_agent": selected_agent,
            "risk_level": supervisor_decision.get("risk_level"),
            "llm_supervisor_error": supervisor_decision.get("llm_supervisor_error"),
        }
    )

    if selected_agent == "evidence_agent":
        result = await evidence_agent.run(
            thread_id=thread_id,
            sender_name=sender_name,
            message_text=message_text,
            db=db,
            user_id=user_id,
            source_message_id=source_message_id,
            recent_messages=recent_messages,
        )
        result.setdefault("intent", supervisor_decision.get("reason"))
        _attach_debug(result, debug)
        return result

    if selected_agent == "trusted_contact_agent":
        result = await trusted_contact_agent.run(
            thread_id=thread_id,
            sender_name=sender_name,
            message_text=message_text,
            db=db,
            user_id=user_id,
            recent_messages=recent_messages,
        )
        result.setdefault("intent", supervisor_decision.get("reason"))
        _attach_debug(result, debug)
        return result

    if selected_agent == "crisis_agent":
        result = crisis_agent.run(
            thread_id=thread_id,
            sender_name=sender_name,
            message_text=message_text,
            recent_messages=recent_messages,
            previous_assistant_message=previous_assistant_message,
            pending_question=pending_question_before,
            crisis_stage=crisis_stage_before,
            crisis_context=crisis_context_before,
        )
    else:
        result = agent.run(
            thread_id=thread_id,
            sender_name=sender_name,
            message_text=message_text,
            recent_messages=recent_messages,
        )
    result.setdefault("intent", supervisor_decision.get("reason"))
    _attach_debug(result, debug)
    return result


def _attach_debug(result: dict[str, Any], debug: dict[str, Any]) -> None:
    debug["selected_agent"] = result.get("agent") or debug.get("selected_agent")
    debug["risk_level"] = result.get("risk_level") or debug.get("risk_level")
    debug["llm_agent_error"] = result.get("llm_agent_error")
    debug["used_agent_fallback"] = result.get("used_agent_fallback")
    debug["pending_intent_after"] = result.get("pending_intent")
    debug["crisis_stage_after"] = result.get("crisis_stage")
    debug["used_crisis_playbook"] = bool(result.get("used_crisis_playbook"))
    debug["used_llm_rewrite"] = bool(result.get("used_llm_rewrite"))
    debug["generated_reply_length"] = result.get("generated_reply_length") or len(result.get("reply") or "")
    debug["final_reply_length"] = len(result.get("reply") or "")
    result["debug"] = debug


_AGENTS = {
    "crisis_agent": crisis_agent,
    "abuse_pattern_agent": abuse_pattern_agent,
    "safety_planning_agent": safety_planning_agent,
    "evidence_agent": evidence_agent,
    "trusted_contact_agent": trusted_contact_agent,
    "stealth_agent": stealth_agent,
    "general_agent": general_agent,
}


def _should_continue_crisis_pending(message_text: str, crisis_signals: dict[str, Any]) -> bool:
    normalized = " ".join((message_text or "").lower().strip().split())
    if not normalized:
        return True

    if crisis_signals.get("is_crisis"):
        return True

    crisis_followups = {
        "yes",
        "no",
        "yeah",
        "yup",
        "ok",
        "okay",
        "please",
        "help",
        "help me",
        "tell me",
        "continue",
        "what now",
        "now what",
    }
    if normalized in crisis_followups:
        return True

    followup_phrases = (
        "what should i do",
        "what to do",
        "give me answer",
        "help me what",
        "are they near",
        "he is near",
        "they are near",
        "not near",
        "not nearby",
        "safe now",
        "not safe",
        "still here",
        "near me",
    )
    return any(phrase in normalized for phrase in followup_phrases)
