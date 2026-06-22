import json
import re


class BaseLLMClient:
    def generate_text(self, prompt: str, **kwargs) -> str:
        raise NotImplementedError

    def generate_json(self, prompt: str, schema: dict | None = None, **kwargs) -> dict:
        raise NotImplementedError


def parse_json_object(text: str) -> dict:
    cleaned_text = _strip_markdown_fences(text.strip())
    try:
        parsed = json.loads(cleaned_text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned_text, flags=re.DOTALL)
        if not match:
            raise
        parsed = json.loads(match.group(0))

    if not isinstance(parsed, dict):
        raise ValueError("LLM response JSON must be an object.")

    return parsed


def _strip_markdown_fences(text: str) -> str:
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()
