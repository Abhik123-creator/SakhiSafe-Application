import logging
from fastapi import APIRouter, Request, HTTPException, status
from app.config import get_settings

logger = logging.getLogger("telegram-router")
router = APIRouter(tags=["Telegram Webhook"])

@router.post("/webhook")
async def post_telegram_webhook(request: Request):
    """
    Inbound Telegram Webhook event dispatcher.
    Returns HTTP 501 Not Implemented if integration is disabled or not yet parsed.
    """
    settings = get_settings()
    
    if not settings.TELEGRAM_ENABLED:
        logger.warning("Received inbound Telegram webhook but TELEGRAM_ENABLED is set to False.")
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Telegram platform integration is currently disabled."
        )

    # Fallback to prevent execution into stubs
    logger.info("Telegram integration is enabled but parser code is currently not active.")
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Telegram parsing logic is not yet implemented."
    )
