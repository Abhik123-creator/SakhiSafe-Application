from typing import List, Optional
from pydantic import BaseModel, Field

class WhatsAppProfile(BaseModel):
    name: str

class WhatsAppContact(BaseModel):
    profile: WhatsAppProfile
    wa_id: str

class WhatsAppMetadata(BaseModel):
    display_phone_number: str
    phone_number_id: str

class WhatsAppMessageText(BaseModel):
    body: str

class WhatsAppMessageImage(BaseModel):
    id: str
    mime_type: str
    sha256: str
    caption: Optional[str] = None

class ButtonReply(BaseModel):
    id: str
    title: str

class ListReply(BaseModel):
    id: str
    title: str
    description: Optional[str] = None

class WhatsAppInteractive(BaseModel):
    type: str
    button_reply: Optional[ButtonReply] = None
    list_reply: Optional[ListReply] = None

class WhatsAppRawMessage(BaseModel):
    """
    Sub-model representing the core individual message block.
    """
    from_number: str = Field(..., alias="from")
    id: str
    timestamp: str
    type: str
    text: Optional[WhatsAppMessageText] = None
    image: Optional[WhatsAppMessageImage] = None
    interactive: Optional[WhatsAppInteractive] = None

class WhatsAppValue(BaseModel):
    messaging_product: str
    metadata: WhatsAppMetadata
    contacts: Optional[List[WhatsAppContact]] = None
    messages: Optional[List[WhatsAppRawMessage]] = None

class WhatsAppChange(BaseModel):
    value: WhatsAppValue
    field: str

class WhatsAppEntry(BaseModel):
    id: str
    changes: List[WhatsAppChange]

class WhatsAppWebhookPayload(BaseModel):
    """
    Top-level payload structure sent by Meta Developer portal webhooks.
    Can be used for strong type verification in routers.
    """
    object: str
    entry: List[WhatsAppEntry]
