import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Alert, TrustedContact


logger = logging.getLogger("sakhi-ai-service.tools.trusted_contacts")


async def add_trusted_contact(
    db: AsyncSession,
    user_id: int,
    name: str,
    phone: str,
    relationship: str | None,
) -> int:
    contact = TrustedContact(
        user_id=user_id,
        name=name.strip(),
        phone=phone.strip(),
        relationship=relationship.strip() if relationship else None,
        verified=False,
    )
    db.add(contact)
    await db.flush()
    logger.info("Created trusted contact id=%s user_id=%s relationship=%s", contact.id, user_id, relationship)
    return contact.id


async def list_trusted_contacts(db: AsyncSession, user_id: int) -> list[TrustedContact]:
    result = await db.execute(
        select(TrustedContact)
        .where(TrustedContact.user_id == user_id)
        .order_by(TrustedContact.created_at.asc(), TrustedContact.id.asc())
    )
    return list(result.scalars().all())


async def create_alert_record(db: AsyncSession, user_id: int, alert_type: str, message: str) -> int:
    # TODO: Real WhatsApp sending will be implemented in a later phase.
    alert = Alert(
        user_id=user_id,
        alert_type=alert_type,
        message=message,
        status="prepared",
    )
    db.add(alert)
    await db.flush()
    logger.info("Created alert record id=%s user_id=%s alert_type=%s status=prepared", alert.id, user_id, alert_type)
    return alert.id
