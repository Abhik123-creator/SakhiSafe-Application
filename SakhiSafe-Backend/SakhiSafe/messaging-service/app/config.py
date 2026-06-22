from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    """
    Application Settings loaded from the shell environment.
    Supports reading from a local .env file.
    """
    # --- Meta App & API ---
    APP_ID: str = ""
    APP_SECRET: str = ""
    ACCESS_TOKEN: str = ""
    WABA_ID: str = ""
    PHONE_NUMBER_ID: str = ""
    VERIFY_TOKEN: str = ""
    GRAPH_VERSION: str = "v25.0"

    # --- Local vs Deployed ---
    USE_NGROK: bool = False
    PUBLIC_URL: str = ""
    NGROK_AUTHTOKEN: str = ""

    # --- Auto Configuration & Simulation ---
    AUTO_CONFIGURE_META: bool = False
    REGISTER_META_WEBHOOK: bool = False  # Acts as trigger for auto-registration

    ENABLE_TYPING_SIMULATION: bool = False
    ENABLE_READ_RECEIPTS: bool = False
    DEFAULT_REPLY_TEXT: str = "SakhiSafe AI service is temporarily unavailable. Please try again in a moment."

    # --- Forwarding Target ---
    TARGET_URL: str = "http://localhost:8080/downstream" # downstream endpoint to POST normalised messages
    AI_SERVICE_BASE_URL: str = ""      # optional explicit AI service base URL for media ingest
    TARGET_TIMEOUT_SECONDS: int = 30
    TARGET_MAX_RETRIES: int = 2
    TARGET_AUTH_HEADER: str = ""     # optional Bearer token for downstream

    # --- App ---
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    LOG_LEVEL: str = "info"          # uvicorn log level
    STALE_MESSAGE_THRESHOLD_SECONDS: int = 120

    # --- Telegram (placeholder) ---
    TELEGRAM_BOT_TOKEN: str = ""     # required only when Telegram is enabled
    TELEGRAM_ENABLED: bool = False

    # --- Google Cloud Storage ---
    GCS_ENABLED: bool = False
    GCS_BUCKET_NAME: str = ""
    GCS_CREDENTIALS_FILE: str = ""   # optional path to service account json key file

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

@lru_cache
def get_settings() -> Settings:
    """
    Cached settings getter to avoid repeated filesystem reading.
    """
    return Settings()
