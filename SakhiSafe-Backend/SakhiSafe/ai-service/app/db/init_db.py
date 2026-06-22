import asyncio
import logging

from sqlalchemy.exc import OperationalError
from sqlalchemy import text

from app.db.models import Base
from app.db.session import engine


logger = logging.getLogger("sakhi-ai-service.db")


async def init_db(max_attempts: int = 20, delay_seconds: float = 1.0) -> None:
    for attempt in range(1, max_attempts + 1):
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
                await _ensure_user_columns(conn)
                await _ensure_incident_columns(conn)
                await _ensure_conversation_columns(conn)
            logger.info("Database tables are ready.")
            return
        except OperationalError:
            if attempt == max_attempts:
                raise
            logger.info("Database not ready yet. attempt=%s/%s", attempt, max_attempts)
            await asyncio.sleep(delay_seconds)


async def _ensure_incident_columns(conn) -> None:
    statements = (
        "ALTER TABLE incidents ADD COLUMN IF NOT EXISTS incident_date VARCHAR(32)",
        "ALTER TABLE incidents ADD COLUMN IF NOT EXISTS incident_time VARCHAR(32)",
        "ALTER TABLE incidents ADD COLUMN IF NOT EXISTS location TEXT",
        "ALTER TABLE incidents ADD COLUMN IF NOT EXISTS backend_case_id VARCHAR(64)",
        "ALTER TABLE incidents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL",
    )
    for statement in statements:
        await conn.execute(text(statement))


async def _ensure_conversation_columns(conn) -> None:
    statements = (
        "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS crisis_stage VARCHAR(64)",
        "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS crisis_context_json JSON",
    )
    for statement in statements:
        await conn.execute(text(statement))


async def _ensure_user_columns(conn) -> None:
    statements = (
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS backend_care_seeker_id VARCHAR(64)",
    )
    for statement in statements:
        await conn.execute(text(statement))
