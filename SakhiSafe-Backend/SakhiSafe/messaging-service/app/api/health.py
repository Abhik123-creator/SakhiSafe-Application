from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter(tags=["Diagnostics"])

@router.get("/health", response_class=JSONResponse)
async def health_check():
    """
    Standard health check endpoint to verify that the service is running.
    Used by docker compose container health checking.
    """
    return {"status": "ok"}

@router.get("/", response_class=JSONResponse)
async def root_meta():
    """
    Service metadata and current version.
    """
    return {
        "service": "messaging-service",
        "version": "0.1.0",
        "description": "Pure adapter-pattern gateway for messaging webhook payloads."
    }
