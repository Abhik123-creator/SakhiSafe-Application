from typing import Optional, Dict, Any
from pydantic import BaseModel, Field

class Sender(BaseModel):
    """
    Generic model representing the sender of a message.
    """
    id: str = Field(..., description="Unique sender ID (e.g. phone number, email, Telegram user ID)")
    name: Optional[str] = Field(None, description="Optional profile display name of the sender")
    platform_metadata: Dict[str, Any] = Field(default_factory=dict, description="Any platform-specific sender metadata")

class MediaInfo(BaseModel):
    """
    Generic model representing resolved message media details.
    """
    id: Optional[str] = Field(None, description="Provider media identifier")
    url: Optional[str] = Field(None, description="Static host HTTP(S) url where the media is hosted")
    caption: Optional[str] = Field(None, description="Caption associated with the media file")
    mime_type: Optional[str] = Field(None, description="MIME type representing the media format")
    filename: Optional[str] = Field(None, description="Inferred or original filename")

class MessageContent(BaseModel):
    """
    Generic model representing the content details of the message.
    """
    text: Optional[str] = Field(None, description="Main text body of the message")
    type: str = Field(..., description="Type of message (e.g. 'text', 'image', 'document', 'interactive')")
    button_id: Optional[str] = Field(None, description="Button ID or list reply ID if the message was interactive")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Platform-specific message custom metadata")

class NormalisedMessage(BaseModel):
    """
    Extensible, generic standardized payload schema for message forwarding.
    Adapters normalize platform-specific payloads into this template,
    making it easily extendable to downstream targets (emails, SMS, CRM systems, Telegram bots, etc.).
    """
    source: str = Field(..., description="Origin platform of the message (e.g. 'whatsapp', 'telegram', 'email', 'sms')")
    message_id: str = Field(..., description="Unique message transaction ID from the source provider")
    timestamp: int = Field(..., description="Unix epoch timestamp of message dispatch")
    sender: Sender = Field(..., description="Extensible info about the message sender")
    message: MessageContent = Field(..., description="Standardized details about the message text and type")
    media: Optional[MediaInfo] = Field(None, description="Resolved media files associated with the message")
    raw: dict = Field(..., description="Full original provider payload for audit logs or deep parsing")
