import logging
import asyncio
import httpx
from typing import Optional
from fastapi import APIRouter, Request, BackgroundTasks, HTTPException, Query, status
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

from app.config import get_settings
from app.models.message import NormalisedMessage
from app.platforms.whatsapp.adapter import WhatsAppAdapter
from app.services.forwarder import forward_message

logger = logging.getLogger("whatsapp-router")
router = APIRouter(tags=["WhatsApp Webhook"])

# Instantiate the adapter
adapter = WhatsAppAdapter()


class OutboundTextMessage(BaseModel):
    recipient: str = Field(..., min_length=1)
    message: str = Field(..., min_length=1)
    message_type: str = "text"


async def post_to_meta(url: str, payload: dict, headers: dict, context: str) -> Optional[httpx.Response]:
    for attempt in range(1, 4):
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                return await client.post(url, json=payload, headers=headers)
        except (httpx.RequestError, httpx.TimeoutException) as e:
            logger.warning(
                f"Meta request failed for {context}: {type(e).__name__}: {repr(e)}. "
                f"Attempt: {attempt}/3"
            )
            if attempt < 3:
                await asyncio.sleep(attempt)
                continue
            logger.error(f"Meta request failed permanently for {context}.", exc_info=True)
            return None

async def send_whatsapp_feedback(message_id: str) -> None:
    """
    Sends a read receipt and optionally a typing simulation indicator back to the sender
    using the WhatsApp Business API.
    """
    settings = get_settings()
    if not settings.ACCESS_TOKEN or not settings.PHONE_NUMBER_ID:
        logger.debug("Skipping WhatsApp receipts/typing. Credentials (ACCESS_TOKEN/PHONE_NUMBER_ID) not configured.")
        return

    if not settings.ENABLE_READ_RECEIPTS:
        logger.debug("Read receipts are disabled in settings.")
        return

    url = f"https://graph.facebook.com/{settings.GRAPH_VERSION}/{settings.PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {settings.ACCESS_TOKEN}",
        "Content-Type": "application/json"
    }

    # Prepare standard read receipt payload
    payload = {
        "messaging_product": "whatsapp",
        "status": "read",
        "message_id": message_id
    }

    # Append typing indicator to the payload if enabled
    if settings.ENABLE_TYPING_SIMULATION:
        payload["typing_indicator"] = {
            "type": "text"
        }
        logger.debug(f"Enabling typing indicator simulation for message {message_id}")

    try:
        logger.info(f"Sending Meta feedback (receipt/typing) for message {message_id}")
        resp = await post_to_meta(url, payload, headers, f"feedback message_id={message_id}")
        if not resp:
            return
        if resp.status_code != 200:
            logger.error(
                f"Meta feedback delivery failure. Status={resp.status_code}, Response={resp.text}"
            )
        else:
            logger.info(f"Meta feedback successfully acknowledged for message {message_id}.")
    except Exception as e:
        logger.error(f"Network error sending feedback to Meta for message {message_id}: {e}", exc_info=True)

async def send_whatsapp_message(recipient_id: str, text_content: str) -> None:
    """
    Sends a text message back to the recipient using the WhatsApp Business API.
    """
    settings = get_settings()
    if not settings.ACCESS_TOKEN or not settings.PHONE_NUMBER_ID:
        logger.debug("Skipping WhatsApp reply. Credentials (ACCESS_TOKEN/PHONE_NUMBER_ID) not configured.")
        return

    recipient_id = recipient_id.strip().lstrip("+")

    # Sanitize markdown for WhatsApp compatibility
    text_content = text_content.replace("**", "*").replace("#", "").strip()


    url = f"https://graph.facebook.com/{settings.GRAPH_VERSION}/{settings.PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {settings.ACCESS_TOKEN}",
        "Content-Type": "application/json"
    }

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": recipient_id,
        "type": "text",
        "text": {
            "preview_url": False,
            "body": text_content
        }
    }

    try:
        logger.info(f"Sending WhatsApp response message to {recipient_id}")
        resp = await post_to_meta(url, payload, headers, f"reply recipient_id={recipient_id}")
        if not resp:
            return
        if resp.status_code != 200:
            logger.error(
                f"Meta response delivery failure. Status={resp.status_code}, Response={resp.text}"
            )
        else:
            logger.info(f"Meta response successfully delivered to {recipient_id}.")
    except Exception as e:
        logger.error(f"Network error sending response to Meta for recipient {recipient_id}: {e}", exc_info=True)


@router.post("/api/v1/messages/send")
async def post_send_message(payload: OutboundTextMessage):
    if payload.message_type != "text":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only text messages are supported.",
        )

    await send_whatsapp_message(payload.recipient, payload.message)
    return {
        "status": "queued",
        "recipient": payload.recipient,
        "message_type": payload.message_type,
    }


async def process_and_forward_message(msg: NormalisedMessage) -> None:
    """
    Composite background task that manages:
    1. Directing feedback (read receipt / typing) back to Meta.
    2. Forwarding the normalized message to the AI service.
    3. Sending the AI service reply back to WhatsApp.
    """
    settings = get_settings()

    logger.info(
        "Received WhatsApp message message_id=%s sender=%s type=%s text=%r",
        msg.message_id,
        msg.sender.id,
        msg.message.type,
        msg.message.text,
    )

    # Step 1: Send feedback to sender
    await send_whatsapp_feedback(msg.message_id)

    # Step 2: Forward to AI service and send its response back to WhatsApp.
    ai_reply = await forward_message(msg)
    reply_text = ai_reply or settings.DEFAULT_REPLY_TEXT

    logger.info(
        "Dispatching response back to user %s. source=%s",
        msg.sender.id,
        "ai-service" if ai_reply else "fallback",
    )
    await send_whatsapp_message(msg.sender.id, reply_text)
    if msg.message.type.lower() == "image":
        logger.info("[WHATSAPP_IMAGE_REPLY_SENT]")


@router.get("/webhook")
async def get_verify_webhook(
    request: Request,
    hub_challenge: str = Query(None, alias="hub.challenge")
):
    """
    Meta developer setup webhook verification.
    Validates token and responds with the challenge.
    """
    is_verified = await adapter.verify_webhook(request)
    if is_verified:
        return HTMLResponse(content=hub_challenge, media_type="text/plain")
    
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Webhook verification failed"
    )

@router.post("/webhook")
async def post_receive_webhook(
    request: Request,
    background_tasks: BackgroundTasks
):
    """
    Real-time webhook events from Meta.
    Verifies payload signature, normalizes the messages,
    queues them in the background, and returns immediately to avoid timeouts.
    """
    # 1. Validate payload signature if WA_APP_SECRET is set
    is_verified = await adapter.verify_webhook(request)
    if not is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Signature validation failed"
        )
    
    # 2. Extract payload JSON
    try:
        payload = await request.json()
    except Exception as e:
        logger.error(f"Inbound webhook body is not valid JSON: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Malformed JSON body"
        )

    # 3. Parse and normalize messages
    base_url = str(request.base_url).rstrip("/")
    messages = await adapter.parse(payload, base_url=base_url)
    
    # 4. Dispatch background tasks for forwarding & Meta feedbacks
    for msg in messages:
        logger.debug(f"Queueing background task to process and forward message: {msg.message_id}")
        background_tasks.add_task(process_and_forward_message, msg)
        
    # 5. Return immediately to prevent Meta from retrying
    return {"status": "received"}
