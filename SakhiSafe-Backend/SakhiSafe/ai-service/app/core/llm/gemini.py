import logging

from google import genai
from google.genai import types

from app.core.llm.base import BaseLLMClient, parse_json_object


logger = logging.getLogger("sakhi-ai-service.llm.gemini")


class GeminiLLMClient(BaseLLMClient):
    def __init__(self, model: str, project: str, location: str = "global") -> None:
        if not project:
            raise ValueError("GOOGLE_CLOUD_PROJECT is required for Vertex AI Gemini.")

        self.model = model
        self.project = project
        self.location = location or "global"
        self.client = genai.Client(
            vertexai=True,
            project=self.project,
            location=self.location,
        )
        logger.info(
            "Initialized Vertex AI Gemini client model=%s project=%s location=%s",
            self.model,
            self.project,
            self.location,
        )

    def generate_text(self, prompt: str, **kwargs) -> str:
        config = _build_generation_config(kwargs)
        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=config,
            )
        except Exception as exc:
            if not config or not _should_retry_without_config(exc):
                raise
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
            )
        _raise_if_truncated(response)
        return response.text or ""

    def generate_json(self, prompt: str, schema: dict | None = None, **kwargs) -> dict:
        text = self.generate_text(prompt, **kwargs)
        return parse_json_object(text)

    def generate_image_json(self, prompt: str, image_bytes: bytes, mime_type: str, **kwargs) -> dict:
        config = _build_generation_config(kwargs)
        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=prompt),
                    types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                ],
            )
        ]
        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=contents,
                config=config,
            )
        except Exception as exc:
            if not config or not _should_retry_without_config(exc):
                raise
            response = self.client.models.generate_content(
                model=self.model,
                contents=contents,
            )
        _raise_if_truncated(response)
        return parse_json_object(response.text or "")


def _build_generation_config(kwargs: dict):
    config = {}

    temperature = kwargs.get("temperature")
    if temperature is not None:
        config["temperature"] = temperature

    max_output_tokens = kwargs.get("max_output_tokens")
    if max_output_tokens is not None:
        config["max_output_tokens"] = max_output_tokens

    thinking_budget = kwargs.get("thinking_budget")
    if thinking_budget is not None:
        config["thinking_config"] = types.ThinkingConfig(thinking_budget=int(thinking_budget))

    return types.GenerateContentConfig(**config) if config else None


def _should_retry_without_config(exc: Exception) -> bool:
    if isinstance(exc, (TypeError, ValueError)):
        return True

    status_code = getattr(exc, "code", None) or getattr(exc, "status_code", None)
    return status_code == 400


def _raise_if_truncated(response) -> None:
    candidates = getattr(response, "candidates", None) or []
    if not candidates:
        return

    finish_reason = getattr(candidates[0], "finish_reason", None)
    finish_value = str(finish_reason or "").lower()
    if "max_tokens" in finish_value or "max_token" in finish_value:
        raise RuntimeError("Gemini response was truncated by max output tokens.")
