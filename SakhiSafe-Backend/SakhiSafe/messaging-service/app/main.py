import logging
import asyncio
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.platforms.whatsapp.router import router as wa_router
from app.platforms.telegram.router import router as tg_router
from app.api.health import router as health_router
from app.services.meta_setup import run_meta_auto_configuration

# Setup Logging
settings = get_settings()
logging.basicConfig(
    level=settings.LOG_LEVEL.upper(),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("messaging-service-main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Unified context manager handling microservice startup and shutdown lifecycles.
    Modern replacement for deprecated @app.on_event startup/shutdown event hooks.
    """
    # --- ON STARTUP ---
    logger.info("Messaging Service microservice startup successful.")
    logger.info(f"Target forwarder URL configured: {settings.TARGET_URL}")
    if settings.TELEGRAM_ENABLED:
        logger.info("Telegram support enabled in configuration.")

    # Spawn Auto-configuration runner programmatically in the background
    if settings.AUTO_CONFIGURE_META or settings.REGISTER_META_WEBHOOK:
        logger.info("Auto-configuration triggers are active. Scheduling webhook self-registration...")
        asyncio.create_task(run_meta_auto_configuration())

    yield

    # --- ON SHUTDOWN ---
    logger.info("Messaging Service microservice shutting down.")

# Initialize FastAPI App with Lifespan
app = FastAPI(
    title="Messaging Service",
    description="A lightweight, high-performance adapter service that receives messaging payloads and forwards them downstream.",
    version="0.1.0",
    lifespan=lifespan
)

# Ensure local static directory exists at startup
os.makedirs("uploads", exist_ok=True)

# Mount local uploads directory as a static file server route
app.mount("/static/uploads", StaticFiles(directory="uploads"), name="uploads")

# Register Routers
app.include_router(wa_router)
app.include_router(tg_router, prefix="/telegram")
app.include_router(health_router)
