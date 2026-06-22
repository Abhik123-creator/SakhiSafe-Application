import unittest
from unittest.mock import AsyncMock, Mock, patch

from app.clients.nest_internal_client import NestInternalClientError
from app.services import whatsapp_intake_service as service


class WhatsAppIntakeServiceTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        service._RECENT_MESSAGES_BY_SESSION.clear()
        service._ACTIVE_INCIDENT_CACHE_BY_PHONE.clear()

    def test_whatsapp_sender_phone_number_is_extracted(self) -> None:
        inbound = service.extract_whatsapp_message(_cloud_payload("919999999999", "I need help", "Anu"))

        self.assertEqual(inbound.phone_number, "+919999999999")
        self.assertEqual(inbound.profile_name, "Anu")
        self.assertEqual(inbound.text, "I need help")

    def test_phone_number_is_normalized(self) -> None:
        self.assertEqual(service.normalize_phone_number("99999 99999"), "+919999999999")
        self.assertEqual(service.normalize_phone_number("+1 (415) 555-0101"), "+14155550101")

    def test_normalized_messaging_payload_extracts_like_whatsapp_inbound(self) -> None:
        payload = service.normalized_message_payload(
            phone_number="99999 99999",
            message_text="My husband hit me yesterday and threatened me today.",
            profile_name="Anu",
            raw_payload={"provider": "adapter"},
        )

        inbound = service.extract_whatsapp_message(payload)

        self.assertEqual(inbound.phone_number, "+919999999999")
        self.assertEqual(inbound.profile_name, "Anu")
        self.assertEqual(inbound.text, "My husband hit me yesterday and threatened me today.")

    async def test_care_seeker_get_or_create_is_called(self) -> None:
        fake_client = _fake_client()
        with patch.object(service, "nest_internal_client", fake_client):
            await service.get_or_create_care_seeker("+919999999999", "Anu")

        fake_client.get_or_create_care_seeker.assert_awaited_once_with(
            {
                "phoneNumber": "+919999999999",
                "whatsappPhoneNumber": "+919999999999",
                "displayName": "Anu",
                "source": "WHATSAPP",
            }
        )

    async def test_active_session_get_or_create_is_called(self) -> None:
        fake_client = _fake_client()
        with patch.object(service, "nest_internal_client", fake_client):
            await service.get_or_create_active_session("care-1")

        fake_client.get_or_create_active_session.assert_awaited_once_with(
            {"careSeekerId": "care-1", "channel": "WHATSAPP"}
        )

    async def test_inbound_message_is_saved(self) -> None:
        fake_client = _fake_client()
        raw_payload = {"raw": True}
        with patch.object(service, "nest_internal_client", fake_client):
            await service.save_conversation_message("session-1", "INBOUND", "Help", raw_payload)

        fake_client.create_conversation_message.assert_awaited_once_with(
            {
                "sessionId": "session-1",
                "direction": "INBOUND",
                "messageType": "TEXT",
                "messageText": "Help",
                "rawPayload": raw_payload,
            }
        )

    async def test_llm_receives_recent_conversation_context(self) -> None:
        fake_client = _fake_client()
        fake_client.get_active_incident_by_phone.return_value = {
            "incidentId": "incident-1",
            "title": "Existing incident",
            "summary": "Existing summary with important previous details.",
            "description": "Existing description that should be preserved when follow-up details arrive.",
            "riskSignals": ["previous threat"],
        }
        fake_client.get_incident_missing_fields_by_phone.return_value = {
            "incidentId": "incident-1",
            "missingFields": ["Current safety status", "Location details"],
        }
        fake_llm = _fake_llm(
            {
                "action": "CONTINUE_CONVERSATION",
                "replyToCareSeeker": "I am here with you.",
            }
        )

        with _patched_flow(fake_client, fake_llm):
            await service.process_whatsapp_inbound(_cloud_payload("919999999999", "He hit me"))

        prompt = fake_llm.generate_json.call_args.args[0]
        self.assertIn("He hit me", prompt)
        self.assertIn("Update the same active incident", prompt)
        self.assertIn("backendMissingFields", prompt)
        self.assertIn("backendActiveIncident", prompt)
        self.assertIn("Current safety status", prompt)
        self.assertIn("Existing summary with important previous details.", prompt)
        self.assertIn("Preserve previous summary and description facts", prompt)
        self.assertIn("at most one gentle optional follow-up question", prompt)
        self.assertIn("record the refusal", prompt)
        fake_client.get_active_incident_by_phone.assert_awaited_once_with("+919999999999")
        fake_client.get_incident_missing_fields_by_phone.assert_awaited_once_with("+919999999999")

    async def test_abuse_message_creates_ai_upsert_call(self) -> None:
        fake_client = _fake_client()
        fake_llm = _fake_llm(_incident_output("He hit me", "HIGH"))

        with _patched_flow(fake_client, fake_llm):
            result = await service.process_whatsapp_inbound(_cloud_payload("919999999999", "He hit me"))

        self.assertEqual(result["action"], "CREATE_OR_UPDATE_INCIDENT")
        fake_client.ai_upsert_incident.assert_awaited_once()
        payload = fake_client.ai_upsert_incident.await_args.args[0]
        self.assertEqual(payload["careSeekerId"], "care-1")
        self.assertEqual(payload["sessionId"], "session-1")
        self.assertEqual(payload["source"], "WHATSAPP")

    async def test_follow_up_message_updates_same_session_incident(self) -> None:
        fake_client = _fake_client()
        fake_llm = _fake_llm(_incident_output("Updated with follow-up", "HIGH"))

        with _patched_flow(fake_client, fake_llm):
            await service.process_whatsapp_inbound(_cloud_payload("919999999999", "He hit me"))
            await service.process_whatsapp_inbound(_cloud_payload("919999999999", "It happened at home"))

        self.assertEqual(fake_client.get_or_create_active_session.await_count, 2)
        session_ids = [call.args[0]["sessionId"] for call in fake_client.ai_upsert_incident.await_args_list]
        self.assertEqual(session_ids, ["session-1", "session-1"])

    async def test_outbound_reply_is_saved(self) -> None:
        fake_client = _fake_client()
        fake_llm = _fake_llm({"action": "CONTINUE_CONVERSATION", "replyToCareSeeker": "Can you tell me when?"})

        with _patched_flow(fake_client, fake_llm):
            await service.process_whatsapp_inbound(_cloud_payload("919999999999", "Help"))

        outbound_payloads = [
            call.args[0]
            for call in fake_client.create_conversation_message.await_args_list
            if call.args[0]["direction"] == "OUTBOUND"
        ]
        self.assertEqual(outbound_payloads[0]["messageText"], "Can you tell me when?")

    async def test_send_reply_can_be_skipped_for_forwarded_messaging_flow(self) -> None:
        fake_client = _fake_client()
        fake_llm = _fake_llm({"action": "CONTINUE_CONVERSATION", "replyToCareSeeker": "I am here."})
        fake_send_reply = AsyncMock(return_value={"sent": True})

        with patch.multiple(
            service,
            nest_internal_client=fake_client,
            get_llm_client=Mock(return_value=fake_llm),
            send_whatsapp_reply=fake_send_reply,
        ):
            result = await service.process_whatsapp_inbound(
                _cloud_payload("919999999999", "Help"),
                send_reply=False,
            )

        self.assertEqual(result["reply"], "I am here.")
        fake_send_reply.assert_not_awaited()

    async def test_invalid_llm_json_does_not_create_fake_incident(self) -> None:
        fake_client = _fake_client()
        fake_llm = _fake_llm({"action": "CREATE_OR_UPDATE_INCIDENT", "replyToCareSeeker": "Bad"})

        with _patched_flow(fake_client, fake_llm):
            result = await service.process_whatsapp_inbound(_cloud_payload("919999999999", "He hit me"))

        self.assertEqual(result["action"], "CONTINUE_CONVERSATION")
        fake_client.ai_upsert_incident.assert_not_awaited()

    async def test_nestjs_failure_is_handled_safely(self) -> None:
        fake_client = _fake_client()
        fake_client.get_or_create_care_seeker.side_effect = NestInternalClientError("boom")

        with _patched_flow(fake_client, _fake_llm({"action": "NO_ACTION", "replyToCareSeeker": "Ok"})):
            result = await service.process_whatsapp_inbound(_cloud_payload("919999999999", "Help"))

        self.assertFalse(result["success"])
        self.assertEqual(result["reply"], service.INCIDENT_SAVE_FALLBACK_REPLY)

    def test_high_risk_message_sets_human_review(self) -> None:
        output = service.validate_llm_json(_incident_output("He threatened to kill me", "CRITICAL"))

        self.assertEqual(output["incident"]["severity"], "CRITICAL")
        self.assertTrue(output["incident"]["needsHumanReview"])

    def test_existing_summary_and_description_are_preserved_for_narrow_follow_up(self) -> None:
        existing = {
            "summary": "Existing summary says the care seeker reported being hit yesterday and threatened today.",
            "description": "Existing description includes the earlier report of physical violence, threats, and fear at home.",
        }
        incoming = {
            "summary": "It happened at home.",
            "description": "She added that it happened at home.",
        }

        merged = service._merge_incident_text_fields(existing, incoming)

        self.assertIn(existing["summary"], merged["summary"])
        self.assertIn("It happened at home.", merged["summary"])
        self.assertIn(existing["description"], merged["description"])
        self.assertIn("She added that it happened at home.", merged["description"])

    def test_image_message_is_detected_and_extracted(self) -> None:
        inbound = service.extract_whatsapp_image_message(_cloud_image_payload("919999999999", "media-1", "Photo proof"))

        self.assertTrue(service.is_whatsapp_image_message(_cloud_image_payload("919999999999", "media-1")))
        self.assertEqual(inbound.phone_number, "+919999999999")
        self.assertEqual(inbound.profile_name, "Care Seeker")
        self.assertEqual(inbound.media_id, "media-1")
        self.assertEqual(inbound.mime_type, "image/png")
        self.assertEqual(inbound.caption, "Photo proof")

    def test_forwarded_image_media_url_is_extracted(self) -> None:
        inbound = service.extract_whatsapp_image_message(
            service.normalized_message_payload(
                phone_number="919999999999",
                message_text="[Image]",
                message_type="image",
                media={"id": "media-1", "url": "https://example.test/image.jpg", "mime_type": "image/jpeg"},
            )
        )

        self.assertEqual(inbound.media_id, "media-1")
        self.assertEqual(inbound.media_url, "https://example.test/image.jpg")

    async def test_image_flow_uploads_evidence_without_llm(self) -> None:
        fake_client = _fake_client()
        fake_llm_factory = Mock(return_value=_fake_llm({"action": "NO_ACTION", "replyToCareSeeker": "No"}))
        fake_send_reply = AsyncMock(return_value={"sent": True})
        downloaded = service.WhatsAppDownloadedMedia(b"image-bytes", "image/png", "whatsapp-media-1.png")

        with patch.multiple(
            service,
            nest_internal_client=fake_client,
            get_llm_client=fake_llm_factory,
            download_whatsapp_media=AsyncMock(return_value=downloaded),
            send_whatsapp_reply=fake_send_reply,
        ):
            result = await service.process_whatsapp_inbound(_cloud_image_payload("919999999999", "media-1", "Photo proof"))

        self.assertTrue(result["success"])
        self.assertEqual(result["action"], "UPLOAD_IMAGE_EVIDENCE")
        fake_llm_factory.assert_not_called()
        fake_client.get_or_create_care_seeker.assert_awaited_once()
        fake_client.get_or_create_active_session.assert_awaited_once()
        fake_client.ensure_draft_incident_for_session.assert_awaited_once_with(
            {"careSeekerId": "care-1", "sessionId": "session-1", "source": "WHATSAPP"}
        )
        image_messages = [
            call.args[0]
            for call in fake_client.create_conversation_message.await_args_list
            if call.args[0]["messageType"] == "IMAGE"
        ]
        self.assertEqual(image_messages[0]["mediaId"], "media-1")
        self.assertEqual(image_messages[0]["messageText"], "Photo proof")
        fake_client.upload_image_evidence.assert_awaited_once()
        upload_args = fake_client.upload_image_evidence.await_args.args
        self.assertEqual(upload_args[0]["source"], "WHATSAPP")
        self.assertEqual(upload_args[0]["uploadedBy"], "CARE_SEEKER")
        self.assertEqual(upload_args[1], "whatsapp-media-1.png")
        self.assertEqual(upload_args[2], b"image-bytes")
        self.assertEqual(upload_args[3], "image/png")
        fake_send_reply.assert_awaited_once_with("+919999999999", service.IMAGE_UPLOAD_SUCCESS_REPLY)

    async def test_image_download_failure_sends_safe_reply_without_upload(self) -> None:
        fake_client = _fake_client()
        fake_send_reply = AsyncMock(return_value={"sent": True})

        with patch.multiple(
            service,
            nest_internal_client=fake_client,
            download_whatsapp_media=AsyncMock(side_effect=ValueError("download failed")),
            send_whatsapp_reply=fake_send_reply,
        ):
            result = await service.process_whatsapp_inbound(_cloud_image_payload("919999999999", "media-1"))

        self.assertFalse(result["success"])
        self.assertEqual(result["reply"], service.IMAGE_UPLOAD_FAILURE_REPLY)
        fake_client.upload_image_evidence.assert_not_awaited()
        fake_send_reply.assert_awaited_once_with("+919999999999", service.IMAGE_UPLOAD_FAILURE_REPLY)

    async def test_image_evidence_upload_failure_sends_safe_reply(self) -> None:
        fake_client = _fake_client()
        fake_client.upload_image_evidence.side_effect = NestInternalClientError("upload failed")
        fake_send_reply = AsyncMock(return_value={"sent": True})
        downloaded = service.WhatsAppDownloadedMedia(b"image-bytes", "image/png", "whatsapp-media-1.png")

        with patch.multiple(
            service,
            nest_internal_client=fake_client,
            download_whatsapp_media=AsyncMock(return_value=downloaded),
            send_whatsapp_reply=fake_send_reply,
        ):
            result = await service.process_whatsapp_inbound(_cloud_image_payload("919999999999", "media-1"))

        self.assertFalse(result["success"])
        self.assertEqual(result["reply"], service.IMAGE_UPLOAD_FAILURE_REPLY)
        fake_send_reply.assert_awaited_once_with("+919999999999", service.IMAGE_UPLOAD_FAILURE_REPLY)

    async def test_uploaded_image_ingest_uses_provided_bytes_without_llm_or_whatsapp_download(self) -> None:
        fake_client = _fake_client()
        fake_llm_factory = Mock(return_value=_fake_llm({"action": "NO_ACTION", "replyToCareSeeker": "No"}))
        fake_download = AsyncMock()

        with patch.multiple(
            service,
            nest_internal_client=fake_client,
            get_llm_client=fake_llm_factory,
            download_whatsapp_media=fake_download,
        ):
            result = await service.handle_uploaded_whatsapp_image(
                phone_number="919999999999",
                profile_name="Care Seeker",
                caption="Photo proof",
                whatsapp_media_id="media-1",
                mime_type="image/png",
                raw_payload={"raw": True},
                image_bytes=b"image-bytes",
                file_name="whatsapp-media-1.png",
            )

        self.assertTrue(result["success"])
        self.assertEqual(result["replyText"], service.IMAGE_UPLOAD_SUCCESS_REPLY)
        fake_llm_factory.assert_not_called()
        fake_download.assert_not_awaited()
        fake_client.upload_image_evidence.assert_awaited_once()
        upload_args = fake_client.upload_image_evidence.await_args.args
        self.assertEqual(upload_args[0]["careSeekerId"], "care-1")
        self.assertEqual(upload_args[0]["sessionId"], "session-1")
        self.assertEqual(upload_args[0]["incidentId"], "incident-1")
        self.assertEqual(upload_args[0]["caption"], "Photo proof")
        self.assertEqual(upload_args[1], "whatsapp-media-1.png")
        self.assertEqual(upload_args[2], b"image-bytes")
        self.assertEqual(upload_args[3], "image/png")


def _cloud_payload(phone: str, text: str, name: str = "Care Seeker") -> dict:
    return {
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "contacts": [{"wa_id": phone, "profile": {"name": name}}],
                            "messages": [{"from": phone, "type": "text", "text": {"body": text}}],
                        }
                    }
                ]
            }
        ]
    }


def _cloud_image_payload(phone: str, media_id: str, caption: str | None = None, name: str = "Care Seeker") -> dict:
    image = {"id": media_id, "mime_type": "image/png"}
    if caption is not None:
        image["caption"] = caption
    return {
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "contacts": [{"wa_id": phone, "profile": {"name": name}}],
                            "messages": [{"from": phone, "type": "image", "image": image}],
                        }
                    }
                ]
            }
        ]
    }


def _fake_client():
    client = Mock()
    client.get_or_create_care_seeker = AsyncMock(
        return_value={"id": "care-1", "whatsappPhoneNumber": "+919999999999"}
    )
    client.get_or_create_active_session = AsyncMock(
        return_value={"id": "session-1", "activeIncident": {"id": "incident-1"}}
    )
    client.create_conversation_message = AsyncMock(return_value={"id": "message-1"})
    client.ai_upsert_incident = AsyncMock(return_value={"id": "incident-1"})
    client.ensure_draft_incident_for_session = AsyncMock(return_value={"id": "incident-1"})
    client.get_incident_missing_fields_by_phone = AsyncMock(return_value=None)
    client.get_active_incident_by_phone = AsyncMock(return_value=None)
    client.upload_image_evidence = AsyncMock(return_value={"id": "evidence-1"})
    return client


def _fake_llm(output: dict):
    llm = Mock()
    llm.generate_json = Mock(return_value=output)
    return llm


def _patched_flow(fake_client, fake_llm):
    return patch.multiple(
        service,
        nest_internal_client=fake_client,
        get_llm_client=Mock(return_value=fake_llm),
        send_whatsapp_reply=AsyncMock(return_value={"sent": True}),
    )


def _incident_output(description: str, severity: str) -> dict:
    return {
        "action": "CREATE_OR_UPDATE_INCIDENT",
        "replyToCareSeeker": "I've updated this in your private case.",
        "incident": {
            "title": "WhatsApp incident report",
            "summary": description,
            "description": f"The care seeker reported: {description}",
            "category": "PHYSICAL_ABUSE",
            "severity": severity,
            "urgency": "URGENT",
            "incidentDateText": None,
            "locationText": None,
            "perpetratorRelation": None,
            "riskSignals": [description],
            "missingFields": ["incidentDateText"],
            "needsHumanReview": False,
            "aiConfidence": 0.8,
            "caseNote": None,
        },
    }


if __name__ == "__main__":
    unittest.main()
