import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Incident, utc_now


logger = logging.getLogger("sakhi-ai-service.tools.evidence")

ALLOWED_INCIDENT_TYPES = {
    "physical",
    "emotional",
    "financial",
    "sexual",
    "stalking",
    "digital",
    "threat",
    "other",
}

ALLOWED_SEVERITIES = {"low", "medium", "high", "critical"}


async def create_incident(
    db: AsyncSession,
    user_id: int,
    incident_type: str,
    severity: str,
    description: str,
    source_message_id: str | None = None,
) -> int:
    if incident_type not in ALLOWED_INCIDENT_TYPES:
        raise ValueError("Invalid incident_type.")

    if severity not in ALLOWED_SEVERITIES:
        raise ValueError("Invalid severity.")

    if not description.strip():
        raise ValueError("Description is required.")

    try:
        # TODO: Encrypt description before storing incidents in production.
        incident = Incident(
            user_id=user_id,
            incident_type=incident_type,
            severity=severity,
            description=description.strip(),
            source_message_id=source_message_id,
        )
        db.add(incident)
        await db.flush()
        logger.info(
            "Created incident id=%s user_id=%s type=%s severity=%s source_message_id=%s",
            incident.id,
            user_id,
            incident_type,
            severity,
            source_message_id,
        )
        return incident.id
    except Exception:
        await db.rollback()
        logger.exception(
            "Failed to create incident for user_id=%s type=%s severity=%s source_message_id=%s",
            user_id,
            incident_type,
            severity,
            source_message_id,
        )
        raise


async def list_incidents(db: AsyncSession, user_id: int, limit: int = 10) -> list[Incident]:
    result = await db.execute(
        select(Incident)
        .where(Incident.user_id == user_id)
        .order_by(Incident.created_at.desc(), Incident.id.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_latest_incident(db: AsyncSession, user_id: int) -> Incident | None:
    result = await db.execute(
        select(Incident)
        .where(Incident.user_id == user_id)
        .order_by(Incident.created_at.desc(), Incident.id.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def update_latest_incident(
    db: AsyncSession,
    user_id: int,
    incident_date: str | None = None,
    incident_time: str | None = None,
    location: str | None = None,
    additional_note: str | None = None,
) -> dict:
    incident = await get_latest_incident(db, user_id)
    if incident is None:
        return {"success": False, "reason": "no_incident_found"}

    updated_fields = []
    if incident_date:
        incident.incident_date = incident_date
        updated_fields.append("date")

    if incident_time:
        incident.incident_time = incident_time
        updated_fields.append("time")

    if location:
        incident.location = location
        updated_fields.append("location")

    if additional_note:
        # TODO: Encrypt sensitive appended notes before production use.
        incident.description = f"{incident.description}\nAdditional note: {additional_note.strip()}"
        updated_fields.append("details")

    incident.updated_at = utc_now()
    await db.flush()
    logger.info(
        "Updated latest incident id=%s user_id=%s fields=%s",
        incident.id,
        user_id,
        ",".join(updated_fields) or "none",
    )
    return {"success": True, "incident": incident, "updated_fields": updated_fields}
