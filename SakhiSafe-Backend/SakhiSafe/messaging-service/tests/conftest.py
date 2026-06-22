import asyncio
import os
import shutil
import pytest
import pytest_asyncio
from typing import AsyncGenerator

from app.config import Settings, get_settings
from app.main import app

# Clear any active test uploads directory at startup
TEST_UPLOADS_DIR = "uploads"

@pytest.fixture(scope="session", autouse=True)
def setup_test_directories():
    """
    Ensures the uploads directory is fresh and active.
    """
    os.makedirs(TEST_UPLOADS_DIR, exist_ok=True)
    yield
    # Clean up test directories after the entire suite completes
    if os.path.exists(TEST_UPLOADS_DIR):
        shutil.rmtree(TEST_UPLOADS_DIR, ignore_errors=True)

@pytest.fixture(scope="session")
def override_settings() -> Settings:
    """
    Overrides live environment variables with fixed, secure test values.
    """
    settings = get_settings()
    settings.APP_ID = "123456"
    settings.APP_SECRET = "test_app_secret_key"
    settings.ACCESS_TOKEN = "test_access_token_123"
    settings.VERIFY_TOKEN = "test_verify_token_xyz"
    settings.PHONE_NUMBER_ID = "987654"
    settings.WABA_ID = "112233"
    
    settings.USE_NGROK = False
    settings.PUBLIC_URL = "http://test-server.local"
    settings.AUTO_CONFIGURE_META = False
    settings.REGISTER_META_WEBHOOK = False
    
    settings.ENABLE_TYPING_SIMULATION = True
    settings.ENABLE_READ_RECEIPTS = True
    
    settings.TARGET_URL = "http://downstream-mock.local/webhook"
    
    return settings

@pytest_asyncio.fixture
async def async_client() -> AsyncGenerator:
    """
    Creates an asynchronous HTTPX client bound to the FastAPI application.
    """
    from httpx import AsyncClient, ASGITransport
    
    # We use ASGI transport to run the tests in-memory
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test-server.local"
    ) as client:
        yield client
