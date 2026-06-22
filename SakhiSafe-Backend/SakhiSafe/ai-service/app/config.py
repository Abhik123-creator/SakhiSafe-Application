import json
import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv


load_dotenv(Path(__file__).resolve().parents[1] / ".env")


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except ValueError:
        return default


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


def _cors_origins() -> list[str]:
    raw_value = os.getenv("CORS_ORIGINS", '["*"]')
    try:
        parsed = json.loads(raw_value)
    except json.JSONDecodeError:
        parsed = [origin.strip() for origin in raw_value.split(",")]

    return [origin for origin in parsed if origin]


@dataclass(frozen=True)
class Settings:
    app_name: str = "SakhiSafe AI Service"
    app_env: str = "local"
    app_debug: bool = True
    database_url: str = "postgresql+asyncpg://sakhi_user:sakhi_password@postgres:5432/sakhi_safe"
    enable_llm_supervisor: bool = False
    enable_llm_agent_responses: bool = False
    llm_provider: str = "gemini"
    llm_api_key: str = ""
    llm_model: str = "gemini-2.5-flash"
    llm_supervisor_temperature: float = 0.1
    llm_agent_temperature: float = 0.7
    llm_max_output_tokens: int = 500
    llm_thinking_budget: int = 0
    llm_agent_max_chars: int = 900
    gemini_model: str = "gemini-2.5-flash"
    vertex_gemini_model: str = "gemini-2.5-flash"
    google_genai_use_vertexai: bool = True
    google_cloud_project: str = ""
    google_cloud_location: str = "us-central1"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-5"
    nest_internal_base_url: str = "http://localhost:4000"
    internal_service_client_id: str = "sakhi-ai-service"
    internal_service_client_secret: str = ""
    service_token_refresh_buffer_seconds: int = 60
    nest_internal_timeout_seconds: float = 5.0
    whatsapp_provider: str = ""
    whatsapp_send_url: str = ""
    whatsapp_access_token: str = ""
    whatsapp_api_version: str = "v25.0"
    vision_max_image_bytes: int = 10_485_760
    vision_http_timeout_ms: int = 15_000
    cors_origins: list[str] = field(default_factory=_cors_origins)

    @property
    def LLM_PROVIDER(self) -> str:
        return self.llm_provider

    @property
    def LLM_API_KEY(self) -> str:
        return self.llm_api_key

    @property
    def LLM_MODEL(self) -> str:
        return self.llm_model

    @property
    def GEMINI_MODEL(self) -> str:
        return self.gemini_model

    @property
    def VERTEX_GEMINI_MODEL(self) -> str:
        return self.vertex_gemini_model

    @property
    def GOOGLE_GENAI_USE_VERTEXAI(self) -> bool:
        return self.google_genai_use_vertexai

    @property
    def GOOGLE_CLOUD_PROJECT(self) -> str:
        return self.google_cloud_project

    @property
    def GOOGLE_CLOUD_LOCATION(self) -> str:
        return self.google_cloud_location

    @property
    def ANTHROPIC_API_KEY(self) -> str:
        return self.anthropic_api_key

    @property
    def ANTHROPIC_MODEL(self) -> str:
        return self.anthropic_model


settings = Settings(
    app_name=os.getenv("APP_NAME", "SakhiSafe AI Service"),
    app_env=os.getenv("APP_ENV", "local"),
    app_debug=os.getenv("APP_DEBUG", "true").lower() == "true",
    database_url=os.getenv("DATABASE_URL", "postgresql+asyncpg://sakhi_user:sakhi_password@postgres:5432/sakhi_safe"),
    enable_llm_supervisor=os.getenv("ENABLE_LLM_SUPERVISOR", "false").lower() == "true",
    enable_llm_agent_responses=os.getenv("ENABLE_LLM_AGENT_RESPONSES", "false").lower() == "true",
    llm_provider=os.getenv("LLM_PROVIDER", "gemini").lower(),
    llm_api_key=os.getenv("LLM_API_KEY", ""),
    llm_model=os.getenv("LLM_MODEL", "gemini-2.5-flash"),
    llm_supervisor_temperature=_env_float("LLM_SUPERVISOR_TEMPERATURE", 0.1),
    llm_agent_temperature=_env_float("LLM_AGENT_TEMPERATURE", 0.7),
    llm_max_output_tokens=_env_int("LLM_MAX_OUTPUT_TOKENS", 500),
    llm_thinking_budget=_env_int("LLM_THINKING_BUDGET", 0),
    llm_agent_max_chars=_env_int("LLM_AGENT_MAX_CHARS", 900),
    gemini_model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
    vertex_gemini_model=os.getenv("VERTEX_GEMINI_MODEL", os.getenv("GEMINI_MODEL", "gemini-2.5-flash")),
    google_genai_use_vertexai=os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "true").lower() == "true",
    google_cloud_project=os.getenv("GOOGLE_CLOUD_PROJECT", ""),
    google_cloud_location=os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1"),
    anthropic_api_key=os.getenv("ANTHROPIC_API_KEY", ""),
    anthropic_model=os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5"),
    nest_internal_base_url=os.getenv("NEST_INTERNAL_BASE_URL", "http://localhost:4000").rstrip("/"),
    internal_service_client_id=os.getenv("INTERNAL_SERVICE_CLIENT_ID", "sakhi-ai-service"),
    internal_service_client_secret=os.getenv("INTERNAL_SERVICE_CLIENT_SECRET", ""),
    service_token_refresh_buffer_seconds=_env_int("SERVICE_TOKEN_REFRESH_BUFFER_SECONDS", 60),
    nest_internal_timeout_seconds=_env_float("NEST_INTERNAL_TIMEOUT_SECONDS", 5.0),
    whatsapp_provider=os.getenv("WHATSAPP_PROVIDER", "").lower(),
    whatsapp_send_url=os.getenv("WHATSAPP_SEND_URL", ""),
    whatsapp_access_token=os.getenv("WHATSAPP_ACCESS_TOKEN", ""),
    whatsapp_api_version=os.getenv("WHATSAPP_API_VERSION", "v25.0"),
    vision_max_image_bytes=_env_int("VISION_MAX_IMAGE_BYTES", 10_485_760),
    vision_http_timeout_ms=_env_int("VISION_HTTP_TIMEOUT_MS", 15_000),
)
