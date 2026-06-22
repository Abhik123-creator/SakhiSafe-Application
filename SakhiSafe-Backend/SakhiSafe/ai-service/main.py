import logging
import json
from typing import Any

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.coordinator import MessagingResponse, NormalizedMessageRequest, process_agent_message
from app.config import settings
from app.db.init_db import init_db
from app.db.session import get_db
from app.services.conversation_service import (
    get_conversation_history,
    get_last_assistant_message,
    get_or_create_conversation,
    get_or_create_user,
    save_message,
    sender_metadata,
    update_conversation_state,
)
from app.services.whatsapp_intake_service import (
    normalized_message_payload,
    process_whatsapp_inbound,
)
from app.services.vision_analysis_service import VisionAnalysisInput, analyze_case_image


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sakhi-ai-service")

app = FastAPI(title=settings.app_name, version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup() -> None:
    await init_db()


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "error": "Invalid request payload.",
            "details": exc.errors(),
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": exc.detail,
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled request failure.")
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Internal server error.",
        },
    )


@app.get("/health")
async def health() -> dict[str, str]:
    return {
        "service": "ai-service",
        "status": "running",
        "llm_provider": "vertex-ai-gemini" if settings.llm_provider == "gemini" else settings.llm_provider,
        "model": settings.gemini_model if settings.llm_provider == "gemini" else settings.llm_model,
    }


@app.post("/messaging", response_model=MessagingResponse, response_model_exclude_none=True)
async def messaging(payload: NormalizedMessageRequest, db: AsyncSession = Depends(get_db)) -> MessagingResponse:
    source = payload.source
    message_id = payload.message_id
    thread_id = payload.sender.id
    from_number = payload.sender.id
    sender_name = payload.sender.name
    message_text = payload.message.text or ""
    message_type = payload.message.type

    logger.info(
        "Received message source=%s sender_id=%s message_id=%s message_type=%s",
        source,
        thread_id,
        message_id,
        message_type,
    )

    user = await get_or_create_user(db, phone=from_number, display_name=sender_name)
    conversation = await get_or_create_conversation(
        db,
        thread_id=thread_id,
        source=source,
        from_number=from_number,
        sender_name=sender_name,
        metadata=sender_metadata(payload.sender.platform_metadata, payload.media),
    )

    await save_message(
        db,
        conversation_id=conversation.id,
        external_message_id=message_id,
        role="user",
        content=message_text,
        message_type=message_type,
        metadata={"media": payload.media} if payload.media else None,
    )

    normalized_payload = normalized_message_payload(
        phone_number=from_number,
        message_text=message_text,
        profile_name=sender_name,
        raw_payload=payload.raw,
        message_type=message_type,
        media=payload.media,
    )

    if message_type.lower() == "image":
        intake_result = await process_whatsapp_inbound(normalized_payload, send_reply=False)
        reply_text = str(intake_result.get("reply") or "")
        await save_message(
            db,
            conversation_id=conversation.id,
            external_message_id=None,
            role="assistant",
            content=reply_text,
            message_type="text",
            agent_name="evidence_agent",
            intent="image_evidence_upload",
            risk_level="low",
        )
        await update_conversation_state(
            db,
            conversation_id=conversation.id,
            last_agent="evidence_agent",
            last_risk_level="low",
        )
        await db.commit()
        debug = None
        if settings.app_debug:
            debug = {
                "sender_id": from_number,
                "thread_id": thread_id,
                "message_id": message_id,
                "conversation_id": conversation.id,
                "nest_image_upload_success": intake_result.get("success"),
                "nest_care_seeker_id": intake_result.get("careSeekerId"),
                "nest_session_id": intake_result.get("sessionId"),
                "nest_incident_id": intake_result.get("incidentId"),
                "nest_evidence_id": (
                    intake_result.get("evidenceResponse", {}).get("id")
                    if isinstance(intake_result.get("evidenceResponse"), dict)
                    else None
                ),
            }
        return MessagingResponse(
            status="success",
            received=True,
            is_json=True,
            response=reply_text,
            agent="evidence_agent",
            risk_level="low",
            debug=debug,
        )

    recent_messages = await get_conversation_history(db, conversation_id=conversation.id, limit=12)
    previous_assistant_message = await get_last_assistant_message(db, conversation_id=conversation.id)

    agent_result = await process_agent_message(
        thread_id=thread_id,
        sender_name=sender_name,
        message_text=message_text,
        recent_messages=recent_messages,
        db=db,
        user_id=user.id,
        source_message_id=message_id,
        conversation=conversation,
        previous_assistant_message=previous_assistant_message,
        sender_context={"phone": from_number, "name": sender_name, "source": source},
    )

    intake_result = await process_whatsapp_inbound(normalized_payload, send_reply=False)
    if intake_result.get("reply"):
        agent_result["reply"] = str(intake_result["reply"])

    await save_message(
        db,
        conversation_id=conversation.id,
        external_message_id=None,
        role="assistant",
        content=agent_result["reply"],
        message_type="text",
        agent_name=agent_result["agent"],
        intent=agent_result.get("intent"),
        risk_level=agent_result["risk_level"],
    )

    await update_conversation_state(
        db,
        conversation_id=conversation.id,
        pending_intent=agent_result.get("pending_intent"),
        pending_question=agent_result.get("pending_question"),
        pending_payload=agent_result.get("pending_payload"),
        last_agent=agent_result["agent"],
        last_risk_level=agent_result["risk_level"],
        crisis_stage=agent_result.get("crisis_stage"),
        crisis_context=agent_result.get("crisis_context"),
    )

    await db.commit()
    debug = agent_result.get("debug") if settings.app_debug else None
    if debug is not None:
        debug.update(
            {
                "sender_id": from_number,
                "thread_id": thread_id,
                "message_id": message_id,
                "conversation_id": conversation.id,
                "pending_intent_after": agent_result.get("pending_intent"),
                "nest_incident_intake_success": intake_result.get("success"),
                "nest_care_seeker_id": intake_result.get("careSeekerId"),
                "nest_session_id": intake_result.get("sessionId"),
                "nest_incident_action": intake_result.get("action"),
                "nest_incident_id": (
                    intake_result.get("incidentResponse", {}).get("id")
                    if isinstance(intake_result.get("incidentResponse"), dict)
                    else None
                ),
            }
        )
        logger.info(
            "AI_TRACE thread=%s msg=%s history=%s pending=%s supervisor=%s agent=%s risk=%s used_agent_fallback=%s text=%s",
            thread_id,
            message_id,
            debug.get("history_count"),
            debug.get("pending_question_before"),
            debug.get("supervisor_source"),
            agent_result["agent"],
            agent_result["risk_level"],
            debug.get("used_agent_fallback"),
            message_text[:80],
        )

    return MessagingResponse(
        status="success",
        received=True,
        is_json=True,
        response=agent_result["reply"],
        agent=agent_result["agent"],
        risk_level=agent_result["risk_level"],
        debug=debug,
    )


@app.post("/webhooks/whatsapp")
async def whatsapp_webhook(payload: dict[str, Any]) -> dict[str, Any]:
    return await process_whatsapp_inbound(payload)


@app.post("/internal/v1/whatsapp/media-ingest")
async def whatsapp_media_ingest(
    fromPhone: str = Form(...),
    messageType: str = Form(...),
    file: UploadFile = File(...),
    profileName: str | None = Form(None),
    caption: str | None = Form(None),
    whatsappMediaId: str = Form(""),
    mimeType: str = Form(""),
    rawPayload: str | None = Form(None),
) -> dict[str, Any]:
    if messageType.upper() != "IMAGE":
        raise HTTPException(status_code=400, detail="Only IMAGE media ingest is supported.")

    raw_payload: dict[str, Any] = {}
    if rawPayload:
        try:
            parsed = json.loads(rawPayload)
            raw_payload = parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            raw_payload = {}

    image_bytes = await file.read()
    resolved_mime_type = (mimeType or file.content_type or "image/jpeg").strip()
    file_name = file.filename or f"whatsapp-{whatsappMediaId or 'media'}.jpg"
    result = await analyze_case_image(
        VisionAnalysisInput(
            image_bytes=image_bytes,
            file_name=file_name,
            mime_type=resolved_mime_type,
            care_seeker_phone=fromPhone,
            whatsapp_media_id=whatsappMediaId,
            caption=caption,
            source="whatsapp",
        )
    )
    return {
        "success": result["success"],
        "replyText": result["suggestedReply"],
        "aiAnalysis": result["aiAnalysis"],
        "backendResponse": result["backendResponse"],
    }


@app.post("/internal/v1/vision/analyze-case-image")
async def analyze_case_image_endpoint(
    file: UploadFile = File(...),
    careSeekerPhone: str = Form(...),
    caseId: str | None = Form(None),
    incidentId: str | None = Form(None),
    sessionId: str | None = Form(None),
    whatsappMessageId: str | None = Form(None),
    whatsappMediaId: str | None = Form(None),
    caption: str | None = Form(None),
    existingCaseNote: str | None = Form(None),
    source: str = Form("whatsapp"),
) -> dict[str, Any]:
    mime_type = (file.content_type or "").strip()
    if not mime_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File MIME type must be image/*.")
    image_bytes = await file.read()
    if len(image_bytes) > settings.vision_max_image_bytes:
        raise HTTPException(status_code=413, detail="Image exceeds VISION_MAX_IMAGE_BYTES.")
    try:
        return await analyze_case_image(
            VisionAnalysisInput(
                image_bytes=image_bytes,
                file_name=file.filename or "case-image.jpg",
                mime_type=mime_type,
                care_seeker_phone=careSeekerPhone,
                case_id=caseId,
                incident_id=incidentId,
                session_id=sessionId,
                whatsapp_message_id=whatsappMessageId,
                whatsapp_media_id=whatsappMediaId,
                caption=caption,
                existing_case_note=existingCaseNote,
                source=source or "whatsapp",
            )
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
