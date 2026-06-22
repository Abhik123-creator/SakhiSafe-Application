import logging
from dataclasses import dataclass

from app.core.llm.factory import get_llm_client


logger = logging.getLogger("sakhi-ai-service.llm.safe_generate")

LLM_TEMPORARY_UNAVAILABLE_REPLY = (
    "I can't generate a proper reply right now. Please try again in a moment. "
    "If you are in immediate danger, contact local emergency services or someone trusted now."
)

UNSAFE_PHRASES = (
    "i sent",
    "alert sent",
    "message sent",
    "guarantee your safety",
    "guarantee legal",
    "confront him",
    "confront them",
)


@dataclass(frozen=True)
class SafeReplyResult:
    reply: str
    used_fallback: bool
    error: str | None = None


def generate_safe_reply(settings, prompt: str, fallback: str, max_chars: int = 700) -> str:
    return generate_safe_reply_result(settings, prompt, fallback, max_chars).reply


def generate_safe_reply_result(settings, prompt: str, fallback: str, max_chars: int = 700) -> SafeReplyResult:
    if not settings.enable_llm_agent_responses:
        return _temporary_error("llm_agent_responses_disabled")

    try:
        client = get_llm_client(settings)
    except Exception as exc:
        logger.warning("LLM agent client initialization failed. Returning temporary error. error=%s", type(exc).__name__)
        return _temporary_error(type(exc).__name__)

    if client is None:
        logger.warning("LLM agent responses enabled but no supported client is configured.")
        return _temporary_error("llm_client_unavailable")

    try:
        reply = client.generate_text(
            prompt,
            temperature=settings.llm_agent_temperature,
            max_output_tokens=settings.llm_max_output_tokens,
            thinking_budget=settings.llm_thinking_budget,
        ).strip()
    except Exception as exc:
        logger.warning("LLM agent response failed. Returning temporary error. error=%s", type(exc).__name__)
        return _temporary_error(type(exc).__name__)

    if not reply:
        return _temporary_error("empty_llm_reply")

    if _looks_unsafe(reply):
        logger.warning("LLM agent response rejected by safety filter.")
        return _temporary_error("unsafe_llm_reply")

    if _looks_incomplete(reply):
        logger.warning("LLM agent response rejected because it appears incomplete.")
        return _temporary_error("incomplete_llm_reply")

    return SafeReplyResult(reply=reply, used_fallback=False)


def _temporary_error(error: str) -> SafeReplyResult:
    return SafeReplyResult(reply=LLM_TEMPORARY_UNAVAILABLE_REPLY, used_fallback=False, error=error)


def _looks_unsafe(reply: str) -> bool:
    lowered = reply.lower()
    return any(phrase in lowered for phrase in UNSAFE_PHRASES)


def _looks_incomplete(reply: str) -> bool:
    stripped = reply.strip()
    if not stripped:
        return True

    if stripped[-1] in {",", ":", ";", "-"}:
        return True

    if stripped.count('"') % 2 != 0:
        return True

    trailing_words = ("and", "or", "but", "because", "when", "if", "so", "to", "with", "for", "of", "in")
    last_word = stripped.lower().rstrip(".!?").split()[-1]
    if last_word in trailing_words:
        return True

    lowered = stripped.lower().rstrip()
    trailing_fragments = (
        "is there",
        "is there one",
        "is there one trusted person",
        "is there one trusted person you",
        "are there",
        "are the",
        "are the people",
        "do you",
        "can you",
        "would you",
        "could you",
        "are you",
        "is he",
        "is she",
        "are they",
        "do they",
        "can they",
        "you can",
        "can message",
        "can message now",
        "if you",
        "making sure you",
    )
    return any(lowered.endswith(fragment) for fragment in trailing_fragments)
