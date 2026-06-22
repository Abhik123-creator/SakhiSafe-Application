from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Conversation, Message, User, utc_now


async def get_or_create_user(db_session: AsyncSession, phone: str, display_name: str | None = None) -> User:
    result = await db_session.execute(select(User).where(User.phone == phone))
    user = result.scalar_one_or_none()
    if user:
        if display_name and user.display_name != display_name:
            user.display_name = display_name
            user.updated_at = utc_now()
        return user

    user = User(phone=phone, display_name=display_name)
    db_session.add(user)
    try:
        await db_session.flush()
        return user
    except IntegrityError:
        await db_session.rollback()
        result = await db_session.execute(select(User).where(User.phone == phone))
        user = result.scalar_one()
        if display_name and user.display_name != display_name:
            user.display_name = display_name
            user.updated_at = utc_now()
            await db_session.flush()
        return user


async def get_or_create_conversation(
    db_session: AsyncSession,
    thread_id: str,
    source: str,
    from_number: str | None = None,
    sender_name: str | None = None,
    metadata: dict | None = None,
) -> Conversation:
    result = await db_session.execute(select(Conversation).where(Conversation.thread_id == thread_id))
    conversation = result.scalar_one_or_none()
    if conversation:
        conversation.updated_at = utc_now()
        if sender_name:
            conversation.sender_name = sender_name
        if from_number:
            conversation.from_number = from_number
        if metadata:
            conversation.metadata_json = metadata
        return conversation

    conversation = Conversation(
        thread_id=thread_id,
        source=source,
        from_number=from_number,
        sender_name=sender_name,
        metadata_json=metadata,
    )
    db_session.add(conversation)
    try:
        await db_session.flush()
        return conversation
    except IntegrityError:
        await db_session.rollback()
        result = await db_session.execute(select(Conversation).where(Conversation.thread_id == thread_id))
        conversation = result.scalar_one()
        conversation.updated_at = utc_now()
        if sender_name:
            conversation.sender_name = sender_name
        if from_number:
            conversation.from_number = from_number
        if metadata:
            conversation.metadata_json = metadata
        await db_session.flush()
        return conversation


async def save_message(
    db_session: AsyncSession,
    conversation_id: int,
    role: str,
    content: str,
    external_message_id: str | None = None,
    message_type: str | None = None,
    agent_name: str | None = None,
    intent: str | None = None,
    risk_level: str | None = None,
    metadata: dict | None = None,
) -> Message:
    # TODO: Encrypt sensitive content before storing messages in production.
    message = Message(
        conversation_id=conversation_id,
        external_message_id=external_message_id,
        role=role,
        content=content,
        message_type=message_type,
        agent_name=agent_name,
        intent=intent,
        risk_level=risk_level,
        metadata_json=metadata,
    )
    db_session.add(message)
    await db_session.flush()
    return message


async def get_conversation_history(
    db_session: AsyncSession,
    conversation_id: int,
    limit: int = 12,
) -> list[dict[str, str]]:
    result = await db_session.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.desc(), Message.id.desc())
        .limit(limit)
    )
    messages = list(result.scalars().all())
    return [
        {
            "role": message.role,
            "content": message.content,
        }
        for message in reversed(messages)
    ]


async def get_last_assistant_message(db_session: AsyncSession, conversation_id: int) -> str | None:
    result = await db_session.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id, Message.role == "assistant")
        .order_by(Message.created_at.desc(), Message.id.desc())
        .limit(1)
    )
    message = result.scalar_one_or_none()
    return message.content if message else None


async def update_conversation_state(
    db_session: AsyncSession,
    conversation_id: int,
    pending_intent: str | None = None,
    pending_question: str | None = None,
    pending_payload: dict | None = None,
    last_agent: str | None = None,
    last_risk_level: str | None = None,
    crisis_stage: str | None = None,
    crisis_context: dict | None = None,
) -> None:
    conversation = await db_session.get(Conversation, conversation_id)
    if not conversation:
        return

    conversation.pending_intent = pending_intent
    conversation.pending_question = pending_question
    conversation.pending_payload_json = pending_payload
    conversation.last_agent = last_agent
    conversation.last_risk_level = last_risk_level
    conversation.crisis_stage = crisis_stage
    conversation.crisis_context_json = crisis_context
    conversation.updated_at = utc_now()


async def clear_pending_intent(db_session: AsyncSession, conversation_id: int) -> None:
    conversation = await db_session.get(Conversation, conversation_id)
    if not conversation:
        return

    conversation.pending_intent = None
    conversation.pending_question = None
    conversation.pending_payload_json = None
    conversation.updated_at = utc_now()


def sender_metadata(platform_metadata: dict[str, Any] | None = None, media: Any = None) -> dict[str, Any]:
    metadata: dict[str, Any] = {}
    if platform_metadata:
        metadata["platform_metadata"] = platform_metadata
    if media is not None:
        metadata["media"] = media
    return metadata
