import unittest
from unittest.mock import AsyncMock, Mock, patch

from app.clients.nest_internal_client import NestInternalNotFoundError
from app.services import vision_analysis_service as service


class VisionAnalysisServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_analyze_case_image_calls_vertex_and_backend(self) -> None:
        fake_client = Mock()
        fake_client.generate_image_json = Mock(return_value=_analysis_output())
        fake_backend = Mock()
        fake_backend.upload_image_analysis_media_observation = AsyncMock(return_value={"id": "evidence-1"})

        with patch.object(service, "GeminiLLMClient", Mock(return_value=fake_client)), patch.object(
            service, "nest_internal_client", fake_backend
        ):
            result = await service.analyze_case_image(_input())

        self.assertTrue(result["success"])
        self.assertEqual(result["suggestedReply"], service.suggested_reply_for(result["aiAnalysis"]))
        fake_client.generate_image_json.assert_called_once()
        args = fake_client.generate_image_json.call_args.args
        self.assertIn("Return JSON exactly matching this schema", args[0])
        self.assertIn("visibleMarkCountEstimate", args[0])
        self.assertIn("Edges or boundaries", args[0])
        self.assertIn("Possible visual pattern resemblance", args[0])
        self.assertIn("body-area reasoning", args[0])
        self.assertEqual(args[1], b"image-bytes")
        self.assertEqual(args[2], "image/png")
        fake_backend.upload_image_analysis_media_observation.assert_awaited_once()
        backend_args = fake_backend.upload_image_analysis_media_observation.await_args.kwargs
        self.assertEqual(backend_args["data"]["careSeekerPhone"], "+919999999999")
        self.assertEqual(backend_args["data"]["whatsappMediaId"], "media-1")
        self.assertIn("aiSummary", backend_args["data"])
        self.assertNotIn("description", backend_args["data"])
        self.assertIn("Overview:", backend_args["data"]["aiSummary"])
        self.assertIn("Visible area:", backend_args["data"]["aiSummary"])
        self.assertIn("Color and pattern:", backend_args["data"]["aiSummary"])
        self.assertIn("Shape, edges, and surface:", backend_args["data"]["aiSummary"])
        self.assertIn("Safety and confidence:", backend_args["data"]["aiSummary"])
        self.assertEqual(backend_args["file_name"], "photo.png")
        self.assertEqual(backend_args["image_bytes"], b"image-bytes")

    async def test_invalid_gemini_output_uses_fallback(self) -> None:
        fake_client = Mock()
        fake_client.generate_image_json = Mock(side_effect=ValueError("not json"))
        fake_backend = Mock()
        fake_backend.upload_image_analysis_media_observation = AsyncMock(return_value={"id": "evidence-1"})

        with patch.object(service, "GeminiLLMClient", Mock(return_value=fake_client)), patch.object(
            service, "nest_internal_client", fake_backend
        ):
            result = await service.analyze_case_image(_input())

        self.assertEqual(result["aiAnalysis"], service.FALLBACK_ANALYSIS)
        self.assertIn("could not clearly analyze", result["suggestedReply"])
        self.assertIn("media observation", result["suggestedReply"])

    async def test_missing_media_observation_endpoint_is_not_hidden_by_evidence_fallback(self) -> None:
        fake_client = Mock()
        fake_client.generate_image_json = Mock(return_value=_analysis_output())
        fake_backend = Mock()
        fake_backend.upload_image_analysis_media_observation = AsyncMock(
            side_effect=NestInternalNotFoundError("missing")
        )
        fake_backend.upload_image_evidence = AsyncMock()

        with patch.object(service, "GeminiLLMClient", Mock(return_value=fake_client)), patch.object(
            service, "nest_internal_client", fake_backend
        ):
            with self.assertRaises(NestInternalNotFoundError):
                await service.analyze_case_image(_input())

        fake_backend.upload_image_evidence.assert_not_called()

    async def test_rejects_non_image(self) -> None:
        with self.assertRaises(ValueError):
            await service.analyze_case_image(_input(mime_type="text/plain"))

    async def test_rejects_oversized_image(self) -> None:
        with self.assertRaises(ValueError):
            await service.analyze_case_image(_input(image_bytes=b"x" * (service.settings.vision_max_image_bytes + 1)))


def _input(
    image_bytes: bytes = b"image-bytes",
    mime_type: str = "image/png",
    incident_id: str | None = "incident-1",
    session_id: str | None = "session-1",
) -> service.VisionAnalysisInput:
    return service.VisionAnalysisInput(
        image_bytes=image_bytes,
        file_name="photo.png",
        mime_type=mime_type,
        care_seeker_phone="+919999999999",
        case_id="case-1",
        incident_id=incident_id,
        session_id=session_id,
        whatsapp_message_id="wamid.1",
        whatsapp_media_id="media-1",
        caption="My arm hurts",
        existing_case_note="Existing note",
    )


def _analysis_output() -> dict:
    return {
        "visibleInjuryPresent": True,
        "imageQuality": "good",
        "bodyPartVisible": "arm",
        "apparentBodyAreaDetailed": "The visible area appears to be part of an arm based on the elongated limb shape.",
        "bodyAreaConfidence": 0.65,
        "possibleVisibleIndicators": ["redness", "swelling"],
        "possibleInjuryTypes": ["swelling", "unclear"],
        "possiblePatternResemblance": ["strike-like mark", "unclear"],
        "patternResemblanceRationale": "The localized red area and swelling-like appearance may resemble a contact mark, but the image alone cannot establish cause.",
        "locationInImage": "The visible marks appear near the center of the frame.",
        "visibleMarkCountEstimate": "two to three",
        "relativeSizeEstimate": "small compared with the visible arm area",
        "edgeBoundaryObservation": "The edges appear irregular and partly blurred.",
        "colorAndPatternObservation": "A red area appears visible.",
        "shapeSizeAndDistributionObservation": "The mark appears localized.",
        "surfaceConditionObservation": "The surface appears raised in one area.",
        "surroundingSkinObservation": "The surrounding visible area appears mostly unchanged.",
        "imageQualityLimitations": ["Single image only.", "Lighting may affect color interpretation."],
        "documentationTags": ["redness", "swelling-like", "localized"],
        "severityEstimate": "medium",
        "confidence": 0.7,
        "concerningSigns": [],
        "urgentCareRecommended": False,
        "nonMedicalDescription": "Visible marks appear on the arm.",
        "professionalCaseNoteDescription": "The uploaded image appears to show visible redness and swelling-like marks. Image quality is good, but this is not diagnostic.",
        "survivorFriendlySummary": "I can see visible marks and saved a careful note.",
        "recommendedFollowUpQuestions": ["Are you in severe pain?"],
        "limitations": ["This is not a medical diagnosis.", "This is not a legal conclusion."],
        "safetyDisclaimer": "This is not a medical diagnosis or legal conclusion.",
    }


if __name__ == "__main__":
    unittest.main()
