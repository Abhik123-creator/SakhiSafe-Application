from app.db.models import Conversation


AFFIRMATIVE_TEXTS = {
    "yes",
    "yes please",
    "yeah",
    "yup",
    "ok",
    "okay",
    "sure",
    "please",
    "do it",
    "continue",
    "help me",
    "make it",
    "save it",
    "send it",
}

NEGATIVE_TEXTS = {
    "no",
    "not now",
    "later",
    "stop",
    "cancel",
    "don't",
    "do not",
    "leave it",
    "no not now",
}


def is_affirmative(text: str) -> bool:
    return _normalized(text) in AFFIRMATIVE_TEXTS


def is_negative(text: str) -> bool:
    return _normalized(text) in NEGATIVE_TEXTS


def resolve_pending_intent(conversation: Conversation, latest_message: str) -> dict | None:
    if not conversation.pending_intent:
        return None

    if is_affirmative(latest_message):
        return {
            "action": "route",
            "agent": conversation.pending_intent,
            "pending_question": conversation.pending_question,
        }

    if is_negative(latest_message):
        return {"action": "cancel"}

    return None


def _normalized(text: str) -> str:
    return " ".join(text.lower().strip().replace("â€™", "'").replace("’", "'").split())
