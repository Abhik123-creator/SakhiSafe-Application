from anthropic import Anthropic

from app.core.llm.base import BaseLLMClient, parse_json_object


class AnthropicLLMClient(BaseLLMClient):
    def __init__(self, api_key: str, model: str) -> None:
        self.model = model
        self.client = Anthropic(api_key=api_key)

    def generate_text(self, prompt: str, **kwargs) -> str:
        request = {
            "model": self.model,
            "max_tokens": _max_tokens(kwargs),
            "messages": [
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
        }
        temperature = kwargs.get("temperature")
        if temperature is not None:
            request["temperature"] = temperature

        response = self.client.messages.create(**request)
        return _extract_text(response)

    def generate_json(self, prompt: str, schema: dict | None = None, **kwargs) -> dict:
        text = self.generate_text(prompt, **kwargs)
        return parse_json_object(text)


def _max_tokens(kwargs: dict) -> int:
    value = kwargs.get("max_output_tokens") or kwargs.get("max_tokens") or 500
    try:
        return int(value)
    except (TypeError, ValueError):
        return 500


def _extract_text(response) -> str:
    parts = []
    for block in getattr(response, "content", []) or []:
        text = getattr(block, "text", None)
        if text:
            parts.append(text)
    return "\n".join(parts).strip()
