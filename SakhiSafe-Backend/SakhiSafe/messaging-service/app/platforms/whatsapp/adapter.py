import base64
import hashlib
import hmac
import logging
import os
import time
from typing import List, Optional

import httpx
from fastapi import Request

from app.config import get_settings
from app.models.message import NormalisedMessage, Sender, MessageContent, MediaInfo
from app.platforms.base import BaseAdapter

logger = logging.getLogger("whatsapp-adapter")

MIME_MAP = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "audio/mpeg": ".mp3",
    "audio/ogg": ".ogg",
    "audio/mp4": ".m4a",
    "application/pdf": ".pdf",
}

def get_extension(mime_type: str) -> str:
    """
    Infers the file extension based on the MIME type.
    Strips parameters like '; codecs=...' to ensure clean extensions.
    """
    clean_mime = mime_type.split(";")[0].strip()
    if clean_mime in MIME_MAP:
        return MIME_MAP[clean_mime]
    ext = clean_mime.split("/")[-1]
    return f".{ext}" if ext else ".bin"


class WhatsAppAdapter(BaseAdapter):
    """
    Adapter for parsing Meta WhatsApp Cloud API webhook payloads
    and validating webhook requests.
    """

    async def verify_webhook(self, request: Request) -> bool:
        """
        Validate the inbound webhook.
        - GET: validates the verification token sent by Meta developer setup.
        - POST: optionally validates request signature using HMAC SHA256 and app secret.
        """
        settings = get_settings()

        if request.method == "GET":
            params = request.query_params
            mode = params.get("hub.mode")
            token = params.get("hub.verify_token")
            
            is_valid = mode == "subscribe" and token == settings.VERIFY_TOKEN
            if is_valid:
                logger.info("Webhook verification token successfully validated.")
            else:
                logger.warning(
                    f"Webhook verification failed. Received mode={mode}, token={token}. "
                    f"Expected token={settings.VERIFY_TOKEN}"
                )
            return is_valid

        elif request.method == "POST":
            if not settings.APP_SECRET:
                # App Secret is not configured, skip cryptographic signature validation
                logger.debug("APP_SECRET is empty. Skipping signature verification.")
                return True

            signature_header = request.headers.get("X-Hub-Signature-256")
            if not signature_header or not signature_header.startswith("sha256="):
                logger.warning("Missing or malformed X-Hub-Signature-256 header on incoming webhook POST.")
                return False

            expected_sig = signature_header.split("sha256=")[1]
            body = await request.body()

            computed_sig = hmac.new(
                settings.APP_SECRET.encode("utf-8"),
                body,
                hashlib.sha256
            ).hexdigest()

            signature_match = hmac.compare_digest(expected_sig, computed_sig)
            if not signature_match:
                logger.warning("Signature mismatch: incoming payload checksum did not match calculated HMAC.")
            return signature_match

        return False

    async def parse(self, payload: dict, base_url: str = "") -> List[NormalisedMessage]:
        """
        Parses Meta WhatsApp Webhook payload and extracts a list of NormalisedMessages.
        Ignores statuses, non-message notifications, and stale messages.
        """
        settings = get_settings()
        normalised_messages: List[NormalisedMessage] = []

        # Validate basic WhatsApp payload structure
        if payload.get("object") != "whatsapp_business_account":
            logger.debug("Received webhook payload for non-whatsapp object. Skipping.")
            return normalised_messages

        entries = payload.get("entry", [])
        for entry in entries:
            changes = entry.get("changes", [])
            for change in changes:
                value = change.get("value", {})
                
                # We are only interested in messaging events
                if "messages" not in value:
                    continue

                messages = value.get("messages", [])
                for raw_msg in messages:
                    try:
                        # 1. Extract and check message timestamp
                        msg_timestamp = int(raw_msg.get("timestamp", 0))
                        current_time = int(time.time())
                        age = current_time - msg_timestamp

                        if age > settings.STALE_MESSAGE_THRESHOLD_SECONDS:
                            logger.warning(
                                f"Dropping stale WhatsApp message: ID={raw_msg.get('id')}, "
                                f"Age={age}s, Threshold={settings.STALE_MESSAGE_THRESHOLD_SECONDS}s"
                            )
                            continue

                        # 2. Extract basic fields
                        message_id = raw_msg.get("id")
                        from_number = raw_msg.get("from")
                        msg_type = raw_msg.get("type")

                        # Initialize optional fields
                        text: Optional[str] = None
                        media_url: Optional[str] = None
                        media_caption: Optional[str] = None
                        media_mime_type: Optional[str] = None
                        media_filename: Optional[str] = None
                        media_id: Optional[str] = None
                        button_id: Optional[str] = None
                        msg_metadata = {}

                        # 3. Parse specific message types
                        if msg_type == "text":
                            text = raw_msg.get("text", {}).get("body")

                        elif msg_type == "image":
                            logger.info("[WHATSAPP_IMAGE_RECEIVED]")
                            image_data = raw_msg.get("image", {})
                            media_caption = image_data.get("caption")
                            text = media_caption if media_caption else "[Image]"

                            media_id = image_data.get("id")
                            media_mime_type = image_data.get("mime_type", "image/jpeg")
                            if media_id:
                                logger.info("[WHATSAPP_IMAGE_MEDIA_ID_EXTRACTED]")
                                media_filename = self._safe_media_filename(media_id, media_mime_type)
                            else:
                                logger.error("WhatsApp image media id is missing.")

                        elif msg_type == "audio":
                            audio_data = raw_msg.get("audio", {})
                            text = "[Audio]"
                            
                            media_id = audio_data.get("id")
                            media_mime_type = audio_data.get("mime_type", "audio/mpeg")
                            if media_id:
                                logger.info(f"Resolving WhatsApp audio media ID: {media_id}")
                                resolved_url = await self._resolve_media(media_id, media_mime_type, base_url)
                                if resolved_url:
                                    media_url = resolved_url
                                else:
                                    logger.error(f"Failed to resolve audio media ID: {media_id}")

                        elif msg_type == "voice":
                            voice_data = raw_msg.get("voice", {})
                            text = "[Voice Note]"
                            
                            media_id = voice_data.get("id")
                            media_mime_type = voice_data.get("mime_type", "audio/ogg; codecs=opus")
                            if media_id:
                                logger.info(f"Resolving WhatsApp voice media ID: {media_id}")
                                resolved_url = await self._resolve_media(media_id, media_mime_type, base_url)
                                if resolved_url:
                                    media_url = resolved_url
                                else:
                                    logger.error(f"Failed to resolve voice media ID: {media_id}")

                        elif msg_type == "video":
                            video_data = raw_msg.get("video", {})
                            media_caption = video_data.get("caption")
                            text = media_caption if media_caption else "[Video]"
                            
                            media_id = video_data.get("id")
                            media_mime_type = video_data.get("mime_type", "video/mp4")
                            if media_id:
                                logger.info(f"Resolving WhatsApp video media ID: {media_id}")
                                resolved_url = await self._resolve_media(media_id, media_mime_type, base_url)
                                if resolved_url:
                                    media_url = resolved_url
                                else:
                                    logger.error(f"Failed to resolve video media ID: {media_id}")

                        elif msg_type == "document":
                            doc_data = raw_msg.get("document", {})
                            media_caption = doc_data.get("caption")
                            media_filename = doc_data.get("filename")
                            text = media_caption if media_caption else (media_filename if media_filename else "[Document]")
                            
                            media_id = doc_data.get("id")
                            media_mime_type = doc_data.get("mime_type", "application/pdf")
                            if media_id:
                                logger.info(f"Resolving WhatsApp document media ID: {media_id}")
                                resolved_url = await self._resolve_media(media_id, media_mime_type, base_url)
                                if resolved_url:
                                    media_url = resolved_url
                                else:
                                    logger.error(f"Failed to resolve document media ID: {media_id}")

                        elif msg_type == "sticker":
                            sticker_data = raw_msg.get("sticker", {})
                            text = "[Sticker]"
                            
                            media_id = sticker_data.get("id")
                            media_mime_type = sticker_data.get("mime_type", "image/webp")
                            if media_id:
                                logger.info(f"Resolving WhatsApp sticker media ID: {media_id}")
                                resolved_url = await self._resolve_media(media_id, media_mime_type, base_url)
                                if resolved_url:
                                    media_url = resolved_url
                                else:
                                    logger.error(f"Failed to resolve sticker media ID: {media_id}")

                        elif msg_type == "location":
                            loc_data = raw_msg.get("location", {})
                            lat = loc_data.get("latitude")
                            lng = loc_data.get("longitude")
                            loc_name = loc_data.get("name")
                            loc_address = loc_data.get("address")
                            
                            loc_summary = []
                            if loc_name:
                                loc_summary.append(loc_name)
                            if loc_address:
                                loc_summary.append(loc_address)
                            loc_summary_str = f" - {', '.join(loc_summary)}" if loc_summary else ""
                            text = f"[Location] Lat: {lat}, Lng: {lng}{loc_summary_str}"
                            
                            msg_metadata["location"] = {
                                "latitude": lat,
                                "longitude": lng,
                                "name": loc_name,
                                "address": loc_address
                            }

                        elif msg_type == "contacts":
                            contacts_data = raw_msg.get("contacts", [])
                            contact_names = []
                            for contact in contacts_data:
                                formatted_name = contact.get("name", {}).get("formatted_name")
                                if formatted_name:
                                    contact_names.append(formatted_name)
                            contact_summary = f": {', '.join(contact_names)}" if contact_names else ""
                            text = f"[Contacts]{contact_summary}"
                            
                            msg_metadata["contacts"] = contacts_data

                        elif msg_type == "reaction":
                            reaction_data = raw_msg.get("reaction", {})
                            reacted_msg_id = reaction_data.get("message_id")
                            emoji = reaction_data.get("emoji")
                            text = f"[Reaction] {emoji}"
                            
                            msg_metadata["reaction"] = {
                                "message_id": reacted_msg_id,
                                "emoji": emoji
                            }

                        elif msg_type == "interactive":
                            interactive_data = raw_msg.get("interactive", {})
                            interactive_type = interactive_data.get("type")

                            if interactive_type == "button_reply":
                                btn_reply = interactive_data.get("button_reply", {})
                                text = btn_reply.get("title")
                                button_id = btn_reply.get("id")

                            elif interactive_type == "list_reply":
                                list_reply = interactive_data.get("list_reply", {})
                                text = list_reply.get("title")
                                button_id = list_reply.get("id")
                            else:
                                logger.info(f"Skipping unsupported interactive type: {interactive_type}")
                                continue
                        else:
                            logger.info(f"Skipping unsupported message type: {msg_type}")
                            continue

                        # 4. Extract sender name from profile contacts if available
                        contacts = value.get("contacts", [])
                        sender_name = None
                        if contacts:
                            sender_name = contacts[0].get("profile", {}).get("name")

                        sender = Sender(
                            id=from_number,
                            name=sender_name,
                            platform_metadata={
                                "wa_id": contacts[0].get("wa_id") if contacts else None
                            }
                        )

                        message_content = MessageContent(
                            text=text,
                            type=msg_type,
                            button_id=button_id,
                            metadata=msg_metadata
                        )

                        media = None
                        if media_id or media_url:
                            media = MediaInfo(
                                id=media_id,
                                url=media_url,
                                caption=media_caption,
                                mime_type=media_mime_type,
                                filename=media_filename if media_filename else (os.path.basename(media_url) if media_url else None)
                            )

                        # 5. Construct Normalized Model
                        norm_msg = NormalisedMessage(
                            source="whatsapp",
                            message_id=message_id,
                            timestamp=msg_timestamp,
                            sender=sender,
                            message=message_content,
                            media=media,
                            raw=payload
                        )
                        normalised_messages.append(norm_msg)
                        logger.info(f"Successfully normalised WhatsApp message {message_id} from {from_number}")

                    except Exception as e:
                        logger.error(f"Error parsing raw WhatsApp message snippet: {raw_msg}. Exception: {e}", exc_info=True)

        return normalised_messages

    async def _resolve_media(self, media_id: str, mime_type: str, base_url: str = "") -> Optional[str]:
        """
        Calls Meta Graph API to resolve a media ID, downloads the binary file,
        saves it locally under the 'uploads' directory, and returns its public URL.
        """
        settings = get_settings()
        if not settings.ACCESS_TOKEN:
            logger.warning("ACCESS_TOKEN not set. Cannot resolve WhatsApp media.")
            return None

        # Create local directory if it does not exist
        uploads_dir = os.path.abspath("uploads")
        os.makedirs(uploads_dir, exist_ok=True)

        headers = {"Authorization": f"Bearer {settings.ACCESS_TOKEN}"}
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                # Step A: Resolve Media ID to download URL
                meta_url = f"https://graph.facebook.com/{settings.GRAPH_VERSION}/{media_id}"
                logger.debug(f"Fetching media metadata from: {meta_url}")
                
                resp = await client.get(meta_url, headers=headers)
                if resp.status_code != 200:
                    logger.error(f"Meta Graph API error resolving media metadata. Status={resp.status_code}, Body={resp.text}")
                    return None
                
                media_meta = resp.json()
                download_url = media_meta.get("url")
                if not download_url:
                    logger.error("Response from Meta Graph did not contain a download 'url' attribute.")
                    return None

                # Step B: Download raw media bytes
                logger.debug(f"Downloading raw media from: {download_url}")
                media_resp = await client.get(download_url, headers=headers)
                if media_resp.status_code != 200:
                    logger.error(f"Meta Graph API error downloading media binary. Status={media_resp.status_code}")
                    return None

                # Step C: Save binary to GCS or local static directory
                media_bytes = media_resp.content
                ext = get_extension(mime_type)
                filename = f"{media_id}{ext}"

                if settings.GCS_ENABLED:
                    logger.info(f"GCS Toggle Active. Uploading media ID {media_id} to Google Cloud Storage bucket '{settings.GCS_BUCKET_NAME}'...")
                    from app.services.gcs import upload_to_gcs
                    gcs_url = await upload_to_gcs(
                        content=media_bytes,
                        destination_blob_name=filename,
                        content_type=mime_type
                    )
                    if gcs_url:
                        logger.info(f"Successfully resolved public GCS URL for downloaded media: {gcs_url}")
                        return gcs_url
                    else:
                        logger.error("Failed to upload file to Google Cloud Storage. Falling back to local file storage...")

                # Local Storage Fallback
                filepath = os.path.join(uploads_dir, filename)
                with open(filepath, "wb") as f:
                    f.write(media_bytes)
                logger.info(f"Successfully saved WhatsApp media file locally to: {filepath}")

                # Step D: Construct public static URL
                if not base_url:
                    # Fallback to configured host / port settings
                    base_url = settings.PUBLIC_URL if settings.PUBLIC_URL else f"http://localhost:{settings.PORT}"

                public_url = f"{base_url.rstrip('/')}/static/uploads/{filename}"
                logger.info(f"Resolved public static URL for downloaded media: {public_url}")
                return public_url

            except Exception as e:
                logger.error(f"Exception raised during media resolution cycle for ID {media_id}: {e}", exc_info=True)
                return None

    def _safe_media_filename(self, media_id: str, mime_type: str) -> str:
        ext = MIME_MAP.get(mime_type, ".jpg")
        safe_media_id = "".join(char if char.isalnum() or char in "._-" else "-" for char in media_id).strip("-")
        return f"whatsapp-{safe_media_id or 'media'}{ext}"
