import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import User
from app.clients.nest_internal_client import NestInternalClientError, nest_internal_client
from app.core.phone import phone_lookup_variants


logger = logging.getLogger("sakhi-ai-service.backend_sync")

RISK_TO_BACKEND = {
    "low": "LOW",
    "medium": "MEDIUM",
    "high": "HIGH",
    "critical": "CRITICAL",
}


async def fetch_cases_for_user(db: AsyncSession, user_id: int) -> Any:
    if not nest_internal_client.enabled:
        return None

    user = await db.get(User, user_id)
    if user is None:
        return None

    try:
        for phone in phone_lookup_variants(user.phone):
            cases = await nest_internal_client.list_cases_by_phone(phone)
            if cases:
                return cases
        return []
    except NestInternalClientError as exc:
        logger.warning("Backend case fetch failed user_id=%s error=%s", user_id, exc)
        return None
