from app.core.llm.base import BaseLLMClient


def get_llm_client(settings) -> BaseLLMClient | None:
    provider = settings.LLM_PROVIDER.lower()

    if provider == "gemini":
        model = settings.GEMINI_MODEL or settings.LLM_MODEL
        from app.core.llm.gemini import GeminiLLMClient

        return GeminiLLMClient(
            model=model,
            project=settings.GOOGLE_CLOUD_PROJECT,
            location=settings.GOOGLE_CLOUD_LOCATION,
        )

    if provider in {"anthropic", "claude"}:
        api_key = settings.ANTHROPIC_API_KEY or settings.LLM_API_KEY
        model = settings.ANTHROPIC_MODEL or settings.LLM_MODEL
        if not api_key:
            return None
        from app.core.llm.anthropic import AnthropicLLMClient

        return AnthropicLLMClient(api_key=api_key, model=model)

    return None
