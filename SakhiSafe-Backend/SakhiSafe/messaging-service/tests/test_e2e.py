import asyncio
import hmac
import hashlib
import json
import os
import time
import pytest
import httpx
from unittest.mock import patch, MagicMock
from httpx import AsyncClient

from app.config import get_settings

# Mark all test cases in this module as async
pytestmark = pytest.mark.asyncio

def generate_signature(body: bytes, secret: str) -> str:
    """
    Helper to compute the X-Hub-Signature-256 header value.
    """
    signature = hmac.new(
        secret.encode("utf-8"),
        body,
        hashlib.sha256
    ).hexdigest()
    return f"sha256={signature}"

async def test_health_check(async_client: AsyncClient):
    """
    E2E: Test the baseline application healthcheck route.
    """
    resp = await async_client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}

async def test_webhook_get_verification_success(async_client: AsyncClient, override_settings):
    """
    E2E: Verify that Meta's synchronous verification GET handshake completes successfully.
    """
    params = {
        "hub.mode": "subscribe",
        "hub.verify_token": override_settings.VERIFY_TOKEN,
        "hub.challenge": "100200300"
    }
    resp = await async_client.get("/webhook", params=params)
    assert resp.status_code == 200
    assert resp.text == "100200300"

async def test_webhook_get_verification_failure(async_client: AsyncClient):
    """
    E2E: Verify that incorrect verify tokens result in a 403 Forbidden.
    """
    params = {
        "hub.mode": "subscribe",
        "hub.verify_token": "wrong_and_malicious_token",
        "hub.challenge": "999"
    }
    resp = await async_client.get("/webhook", params=params)
    assert resp.status_code == 403
    assert "verification failed" in resp.json()["detail"].lower()

async def test_inbound_text_webhook_end_to_end(async_client: AsyncClient, override_settings):
    """
    E2E: Simulate an incoming text message webhook from Meta.
    """
    payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": override_settings.WABA_ID,
                "changes": [
                    {
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {
                                "display_phone_number": "15555555555",
                                "phone_number_id": override_settings.PHONE_NUMBER_ID
                            },
                            "contacts": [
                                {
                                    "profile": {"name": "Alice Developer"},
                                    "wa_id": "919038901219"
                                }
                            ],
                            "messages": [
                                {
                                    "from": "919038901219",
                                    "id": "wamid.HBgMOTE5MDM4OTAxMjE5FQIAEhgUM0E1NjhGRDRBRTc2NURGNEVDNEIA",
                                    "timestamp": str(int(time.time())),
                                    "text": {
                                        "body": "Hello Antigravity!"
                                    },
                                    "type": "text"
                                }
                            ]
                        },
                        "field": "messages"
                    }
                ]
            }
        ]
    }

    body = json.dumps(payload).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": generate_signature(body, override_settings.APP_SECRET)
    }

    # Selective patch side-effect for POST: allows local test-server calls to run in-memory,
    # while mocking out external calls (like downstreams or Meta APIs)
    original_post = httpx.AsyncClient.post
    mocked_posts_tracker = []

    async def mock_post_side_effect(self, url, *args, **kwargs):
        url_str = str(url)
        # Check if the url is relative or targets the local test server
        if url_str.startswith("/") or "test-server.local" in url_str:
            return await original_post(self, url, *args, **kwargs)
        
        # Track and mock external calls
        mocked_posts_tracker.append((url, kwargs))
        resp = MagicMock()
        resp.status_code = 200
        resp.json = lambda: {"success": True, "replyText": "Image attached"}
        resp.text = "OK"
        resp.raise_for_status = lambda: None
        return resp

    with patch("httpx.AsyncClient.post", new=mock_post_side_effect):
        # Execute Post call
        resp = await async_client.post("/webhook", content=body, headers=headers)
        
        # Verify webhook responds synchronously with immediate acknowledgement
        assert resp.status_code == 200
        assert resp.json() == {"status": "received"}

        # Wait a tiny fraction of a second for Uvicorn background tasks to execute
        await asyncio.sleep(0.15)

        # Confirm that external dispatches were recorded
        assert len(mocked_posts_tracker) >= 1
        
        downstream_payload = None
        for mock_url, mock_kwargs in mocked_posts_tracker:
            if "downstream" in str(mock_url):
                downstream_payload = mock_kwargs["json"]
                break
                
        assert downstream_payload is not None
        assert downstream_payload["source"] == "whatsapp"
        assert downstream_payload["sender"]["id"] == "919038901219"
        assert downstream_payload["sender"]["name"] == "Alice Developer"
        assert downstream_payload["message"]["text"] == "Hello Antigravity!"
        assert downstream_payload["message"]["type"] == "text"

async def test_inbound_image_webhook_local_media_save(async_client: AsyncClient, override_settings):
    """
    E2E: Simulate an incoming image webhook.
    Verifies that the microservice successfully downloads the binary from Meta, writes
    the file locally, serves it static, and forwards the custom static file URL downstream.
    """
    media_id = "test_media_id_999"
    mime_type = "image/png"
    dummy_image_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc`\x00\x00\x00\x02\x00\x01H\xaf\xa4q\x00\x00\x00\x00IEND\xaeB`\x82" # 1x1 dummy PNG

    payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": override_settings.WABA_ID,
                "changes": [
                    {
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {
                                "phone_number_id": override_settings.PHONE_NUMBER_ID
                            },
                            "messages": [
                                {
                                    "from": "919038901219",
                                    "id": "wamid.HBgMOTE5MDM4OTAxMjE5FQIAEhgUM0E1NjhGRDRBRTc2NURGNEVDNEIB",
                                    "timestamp": str(int(time.time())),
                                    "type": "image",
                                    "image": {
                                        "caption": "Check this mock image!",
                                        "mime_type": mime_type,
                                        "sha256": "abcdef",
                                        "id": media_id
                                    }
                                }
                            ]
                        },
                        "field": "messages"
                    }
                ]
            }
        ]
    }

    body = json.dumps(payload).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": generate_signature(body, override_settings.APP_SECRET)
    }

    # Selective patch for GET: routes local test-server requests natively,
    # and returns mocked HTTP metadata/binary responses for Meta API endpoints.
    original_get = httpx.AsyncClient.get

    async def mock_get_side_effect(self, url, *args, **kwargs):
        url_str = str(url)
        if url_str.startswith("/") or "test-server.local" in url_str:
            return await original_get(self, url, *args, **kwargs)
        
        # Mock external calls based on route
        resp = MagicMock()
        resp.status_code = 200
        
        if f"/{media_id}" in url_str and not url_str.endswith("/download"):
            # Meta Metadata Info Request
            resp.json = lambda: {
                "id": media_id,
                "url": f"https://graph.facebook.com/v25.0/{media_id}/download",
                "mime_type": mime_type
            }
        elif url_str.endswith("/download"):
            # Meta Binary Download Request
            resp.content = dummy_image_content
        else:
            resp.status_code = 404
            
        return resp

    # Selective patch for POST
    original_post = httpx.AsyncClient.post
    mocked_posts_tracker = []

    async def mock_post_side_effect(self, url, *args, **kwargs):
        url_str = str(url)
        if url_str.startswith("/") or "test-server.local" in url_str:
            return await original_post(self, url, *args, **kwargs)
        
        mocked_posts_tracker.append((url, kwargs))
        resp = MagicMock()
        resp.status_code = 200
        resp.json = lambda: {"success": True, "replyText": "Image attached"}
        resp.text = "OK"
        resp.raise_for_status = lambda: None
        return resp

    # Apply both selective patches
    with patch("httpx.AsyncClient.get", new=mock_get_side_effect), \
         patch("httpx.AsyncClient.post", new=mock_post_side_effect):
        
        # Trigger POST webhook
        resp = await async_client.post("/webhook", content=body, headers=headers)
        assert resp.status_code == 200

        # Yield execution time to async loop for background filesystem & network dispatches
        await asyncio.sleep(0.2)

        assert len(mocked_posts_tracker) >= 1

        ingest_kwargs = None
        for mock_url, kwargs in mocked_posts_tracker:
            if "/internal/v1/whatsapp/media-ingest" in str(mock_url):
                ingest_kwargs = kwargs
                break

        assert ingest_kwargs is not None
        assert ingest_kwargs["data"]["fromPhone"] == "919038901219"
        assert ingest_kwargs["data"]["caption"] == "Check this mock image!"
        assert ingest_kwargs["data"]["whatsappMediaId"] == media_id
        assert ingest_kwargs["data"]["mimeType"] == mime_type
        assert "Content-Type" not in ingest_kwargs["headers"]
        assert ingest_kwargs["files"]["file"][0] == f"whatsapp-{media_id}.png"
        assert ingest_kwargs["files"]["file"][1] == dummy_image_content
        assert ingest_kwargs["files"]["file"][2] == mime_type

async def test_inbound_image_webhook_gcs_save(async_client: AsyncClient, override_settings):
    """
    E2E: Simulate an incoming image webhook with GCS toggle active.
    Verifies that the microservice uploads the file to Google Cloud Storage
    and forwards the returned GCS public URL downstream.
    """
    # 1. Enable GCS Settings
    override_settings.GCS_ENABLED = True
    override_settings.GCS_BUCKET_NAME = "my-test-gcs-bucket"
    
    media_id = "gcs_media_999"
    mime_type = "image/jpeg"
    dummy_image_content = b"fake-jpeg-binary-data"

    payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": override_settings.WABA_ID,
                "changes": [
                    {
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {
                                "phone_number_id": override_settings.PHONE_NUMBER_ID
                            },
                            "messages": [
                                {
                                    "from": "919038901219",
                                    "id": "wamid.HBgMOTE5MDM4OTAxMjE5FQIAEhgUM0E1NjhGRDRBRTc2NURGNEVDNEJD",
                                    "timestamp": str(int(time.time())),
                                    "type": "image",
                                    "image": {
                                        "caption": "Uploading to Google Cloud!",
                                        "mime_type": mime_type,
                                        "sha256": "gcs123",
                                        "id": media_id
                                    }
                                }
                            ]
                        },
                        "field": "messages"
                    }
                ]
            }
        ]
    }

    body = json.dumps(payload).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": generate_signature(body, override_settings.APP_SECRET)
    }

    # Patch outbound Meta Graph API GET requests
    original_get = httpx.AsyncClient.get

    async def mock_get_side_effect(self, url, *args, **kwargs):
        url_str = str(url)
        if url_str.startswith("/") or "test-server.local" in url_str:
            return await original_get(self, url, *args, **kwargs)
        
        resp = MagicMock()
        resp.status_code = 200
        
        if f"/{media_id}" in url_str and not url_str.endswith("/download"):
            resp.json = lambda: {
                "id": media_id,
                "url": f"https://graph.facebook.com/v25.0/{media_id}/download",
                "mime_type": mime_type
            }
        elif url_str.endswith("/download"):
            resp.content = dummy_image_content
        else:
            resp.status_code = 404
            
        return resp

    # Patch outbound downstream POST requests
    original_post = httpx.AsyncClient.post
    mocked_posts_tracker = []

    async def mock_post_side_effect(self, url, *args, **kwargs):
        url_str = str(url)
        if url_str.startswith("/") or "test-server.local" in url_str:
            return await original_post(self, url, *args, **kwargs)
        
        mocked_posts_tracker.append((url, kwargs))
        resp = MagicMock()
        resp.status_code = 200
        resp.json = lambda: {"success": True, "replyText": "Image attached"}
        resp.text = "OK"
        resp.raise_for_status = lambda: None
        return resp

    with patch("httpx.AsyncClient.get", new=mock_get_side_effect), \
         patch("httpx.AsyncClient.post", new=mock_post_side_effect):
        
        resp = await async_client.post("/webhook", content=body, headers=headers)
        assert resp.status_code == 200

        await asyncio.sleep(0.2)

        assert len(mocked_posts_tracker) >= 1

        ingest_kwargs = None
        for mock_url, kwargs in mocked_posts_tracker:
            if "/internal/v1/whatsapp/media-ingest" in str(mock_url):
                ingest_kwargs = kwargs
                break

        assert ingest_kwargs is not None
        assert ingest_kwargs["data"]["fromPhone"] == "919038901219"
        assert ingest_kwargs["data"]["caption"] == "Uploading to Google Cloud!"
        assert ingest_kwargs["data"]["whatsappMediaId"] == media_id
        assert ingest_kwargs["data"]["mimeType"] == mime_type
        assert "Content-Type" not in ingest_kwargs["headers"]
        assert ingest_kwargs["files"]["file"][0] == f"whatsapp-{media_id}.jpg"
        assert ingest_kwargs["files"]["file"][1] == dummy_image_content
        assert ingest_kwargs["files"]["file"][2] == mime_type
