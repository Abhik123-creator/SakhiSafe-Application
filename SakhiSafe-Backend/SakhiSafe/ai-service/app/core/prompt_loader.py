from pathlib import Path
from typing import Any


PROMPTS_DIR = Path(__file__).resolve().parents[1] / "prompts"


def load_prompt(prompt_name: str) -> str:
    prompt_path = PROMPTS_DIR / prompt_name
    return prompt_path.read_text(encoding="utf-8")


def render_prompt(prompt_name: str, context: dict[str, Any] | None = None) -> str:
    prompt = load_prompt(prompt_name)
    values = _stringify_context(context or {})
    for key, value in values.items():
        prompt = prompt.replace(f"{{{key}}}", value)
    return prompt


def _stringify_context(context: dict[str, Any]) -> dict[str, str]:
    defaults = {
        "latest_message": "",
        "conversation_history": "none",
        "risk_level": "none",
        "tool_result": "none",
        "stealth_mode": "none",
        "sender_context": "none",
        "previous_assistant_message": "none",
        "pending_question": "none",
        "pending_state": "none",
    }
    values = {**defaults}
    for key, value in context.items():
        if value is None:
            values[key] = "none"
        else:
            values[key] = str(value)
    return values
