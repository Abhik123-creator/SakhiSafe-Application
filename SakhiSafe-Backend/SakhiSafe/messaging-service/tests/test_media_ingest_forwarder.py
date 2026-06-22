import json
from unittest.mock import patch

import httpx
import pytest

from app.models.message import MediaInfo, MessageContent, NormalisedMessage, Sender
from app.platforms.whatsapp.adapter import WhatsAppAdapter
from app.services.forwarder import IMAGE_FORWARD_FAILURE_REPLY, forward_message


class MockResponse:
    def __init__(self, status_code: int, payload: dict | None = None, content: bytes = b"") -> None:
        self.status_code = status_code
        self._payload = payload or {}
        self.content = content if content else (json.dumps(self._payload).encode("utf-8") if payload is not None else b"")
        self.text = self.content.decode("utf-8", errors="replace")

    def json(self) -> dict:
        return self._payload

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("mock status error", request=None, response=self)


@pytest.mark.asyncio
async def test_text_message_flow_remains_json_forwarding(override_settings):
    calls = []
    message = _text_message()

    async def mock_post(self, url, **kwargs):
        calls.append((url, kwargs))
        return MockResponse(200, {"response": "Text reply"})

    with patch("httpx.AsyncClient.post", new=mock_post):
        reply = await forward_message(message)

    assert reply == "Text reply"
    assert calls[0][0] == override_settings.TARGET_URL
    assert calls[0][1]["json"]["message"]["type"] == "text"
    assert "files" not in calls[0][1]


@pytest.mark.asyncio
async def test_image_webhook_is_detected_and_media_id_extracted(override_settings):
    messages = await WhatsAppAdapter().parse(_image_payload("media-123", "image/png"))

    assert messages[0].message.type == "image"
    assert messages[0].media.id == "media-123"
    assert messages[0].media.mime_type == "image/png"


@pytest.mark.asyncio
async def test_image_forward_downloads_media_and_calls_ai_multipart(override_settings):
    get_calls = []
    post_calls = []
    message = _image_message()

    async def mock_get(self, url, **kwargs):
        get_calls.append((url, kwargs))
        if "graph.facebook.com" in str(url):
            return MockResponse(200, {"url": "https://lookaside.example/media", "mime_type": "image/png"})
        return MockResponse(200, content=b"image-bytes")

    async def mock_post(self, url, **kwargs):
        post_calls.append((url, kwargs))
        return MockResponse(200, {"success": True, "replyText": "Image attached"})

    with patch("httpx.AsyncClient.get", new=mock_get), patch("httpx.AsyncClient.post", new=mock_post):
        reply = await forward_message(message)

    assert reply == "Image attached"
    assert get_calls[0][1]["headers"]["Authorization"] == f"Bearer {override_settings.ACCESS_TOKEN}"
    assert get_calls[1][1]["headers"]["Authorization"] == f"Bearer {override_settings.ACCESS_TOKEN}"

    ingest_url, kwargs = post_calls[0]
    assert str(ingest_url).endswith("/internal/v1/whatsapp/media-ingest")
    assert kwargs["data"]["fromPhone"] == "919999999999"
    assert kwargs["data"]["caption"] == "Photo proof"
    assert kwargs["data"]["whatsappMediaId"] == "media-123"
    assert kwargs["data"]["mimeType"] == "image/png"
    assert json.loads(kwargs["data"]["rawPayload"])["entry"][0]["changes"][0]["value"]["messages"][0]["image"]["id"] == "media-123"
    assert "Content-Type" not in kwargs["headers"]
    assert kwargs["files"]["file"][0] == "whatsapp-media-123.png"
    assert kwargs["files"]["file"][1] == b"image-bytes"
    assert kwargs["files"]["file"][2] == "image/png"


@pytest.mark.asyncio
async def test_download_failure_does_not_call_ai_service(override_settings):
    post_calls = []

    async def mock_get(self, url, **kwargs):
        return MockResponse(500, {"error": "bad"})

    async def mock_post(self, url, **kwargs):
        post_calls.append((url, kwargs))
        return MockResponse(200, {"replyText": "should not happen"})

    with patch("httpx.AsyncClient.get", new=mock_get), patch("httpx.AsyncClient.post", new=mock_post):
        reply = await forward_message(_image_message())

    assert reply == IMAGE_FORWARD_FAILURE_REPLY
    assert post_calls == []


@pytest.mark.asyncio
async def test_ai_service_failure_returns_safe_reply(override_settings):
    async def mock_get(self, url, **kwargs):
        if "graph.facebook.com" in str(url):
            return MockResponse(200, {"url": "https://lookaside.example/media", "mime_type": "image/jpeg"})
        return MockResponse(200, content=b"image-bytes")

    async def mock_post(self, url, **kwargs):
        return MockResponse(500, {"error": "upload failed"})

    with patch("httpx.AsyncClient.get", new=mock_get), patch("httpx.AsyncClient.post", new=mock_post):
        reply = await forward_message(_image_message(mime_type="image/jpeg"))

    assert reply == IMAGE_FORWARD_FAILURE_REPLY


def _text_message() -> NormalisedMessage:
    return NormalisedMessage(
        source="whatsapp",
        message_id="wamid.text",
        timestamp=1,
        sender=Sender(id="919999999999", name="Care Seeker"),
        message=MessageContent(text="Hello", type="text"),
        raw={"raw": True},
    )


def _image_message(mime_type: str = "image/png") -> NormalisedMessage:
    raw = _image_payload("media-123", mime_type)
    return NormalisedMessage(
        source="whatsapp",
        message_id="wamid.image",
        timestamp=1,
        sender=Sender(id="919999999999", name="Care Seeker"),
        message=MessageContent(text="Photo proof", type="image"),
        media=MediaInfo(id="media-123", caption="Photo proof", mime_type=mime_type, filename="whatsapp-media-123.png"),
        raw=raw,
    )


def _image_payload(media_id: str, mime_type: str) -> dict:
    return {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "contacts": [{"wa_id": "919999999999", "profile": {"name": "Care Seeker"}}],
                            "messages": [
                                {
                                    "id": "wamid.image",
                                    "from": "919999999999",
                                    "timestamp": "9999999999",
                                    "type": "image",
                                    "image": {"id": media_id, "mime_type": mime_type, "caption": "Photo proof"},
                                }
                            ],
                        }
                    }
                ]
            }
        ]
    }
