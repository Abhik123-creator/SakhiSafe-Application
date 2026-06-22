import json
import logging
from dataclasses import dataclass
from typing import Any

from app.clients.nest_internal_client import nest_internal_client
from app.config import settings
from app.core.llm.base import parse_json_object
from app.core.llm.gemini import GeminiLLMClient


logger = logging.getLogger("sakhi-ai-service.vision_analysis")

IMAGE_QUALITY_VALUES = {"poor", "fair", "good"}
SEVERITY_VALUES = {"low", "medium", "high", "unknown"}

FALLBACK_ANALYSIS = {
    "visibleInjuryPresent": False,
    "imageQuality": "poor",
    "bodyPartVisible": None,
    "apparentBodyAreaDetailed": "The visible body area could not be identified reliably.",
    "bodyAreaConfidence": 0,
    "possibleVisibleIndicators": ["unclear"],
    "possibleInjuryTypes": ["unclear"],
    "possiblePatternResemblance": ["unclear"],
    "patternResemblanceRationale": "The image could not be analyzed reliably enough to describe visual pattern resemblance.",
    "locationInImage": "The image could not be analyzed reliably.",
    "visibleMarkCountEstimate": "unknown",
    "relativeSizeEstimate": "unknown",
    "edgeBoundaryObservation": "The edges or boundaries of any visible marks could not be assessed reliably.",
    "colorAndPatternObservation": "The image could not be analyzed reliably.",
    "shapeSizeAndDistributionObservation": "The shape, size, and distribution of any visible marks could not be determined reliably.",
    "surfaceConditionObservation": "The surface condition could not be assessed reliably from the image.",
    "surroundingSkinObservation": "The surrounding visible area could not be assessed reliably.",
    "imageQualityLimitations": ["The image could not be analyzed reliably."],
    "documentationTags": ["unclear"],
    "severityEstimate": "unknown",
    "confidence": 0,
    "concerningSigns": [],
    "urgentCareRecommended": False,
    "nonMedicalDescription": "The image could not be analyzed reliably.",
    "professionalCaseNoteDescription": "An image was uploaded, but the AI system could not reliably analyze visible injury indicators from it. The care seeker should be asked to describe what happened, whether they are safe, and whether they need medical attention.",
    "survivorFriendlySummary": "I saved the image, but I could not clearly analyze it. You can describe what happened, and I'll keep that with your case notes.",
    "recommendedFollowUpQuestions": [
        "Can you describe what happened?",
        "When did this happen?",
        "Are you in immediate danger?",
        "Are you in severe pain or bleeding?",
    ],
    "limitations": [
        "The image could not be analyzed reliably.",
        "This is not a medical diagnosis.",
        "This is not a legal conclusion.",
    ],
    "safetyDisclaimer": "This is not a medical diagnosis or legal conclusion.",
}


@dataclass(frozen=True)
class VisionAnalysisInput:
    image_bytes: bytes
    file_name: str
    mime_type: str
    care_seeker_phone: str
    case_id: str | None = None
    incident_id: str | None = None
    session_id: str | None = None
    whatsapp_message_id: str | None = None
    whatsapp_media_id: str | None = None
    caption: str | None = None
    existing_case_note: str | None = None
    source: str = "whatsapp"


async def analyze_case_image(payload: VisionAnalysisInput) -> dict[str, Any]:
    _validate_input(payload)
    ai_analysis = analyze_image_with_vertex(payload)
    suggested_reply = suggested_reply_for(ai_analysis)
    backend_response = await send_image_analysis_to_backend(payload, ai_analysis)
    return {
        "success": True,
        "backendResponse": backend_response,
        "aiAnalysis": ai_analysis,
        "suggestedReply": suggested_reply,
    }


def analyze_image_with_vertex(payload: VisionAnalysisInput) -> dict[str, Any]:
    prompt = build_vision_prompt(payload.caption, payload.existing_case_note)
    try:
        client = GeminiLLMClient(
            model=settings.VERTEX_GEMINI_MODEL,
            project=settings.GOOGLE_CLOUD_PROJECT,
            location=settings.GOOGLE_CLOUD_LOCATION,
        )
        raw = client.generate_image_json(
            prompt,
            payload.image_bytes,
            payload.mime_type,
            temperature=0.1,
            max_output_tokens=max(settings.llm_max_output_tokens, 1200),
            thinking_budget=settings.llm_thinking_budget,
        )
        return validate_vision_analysis(raw)
    except Exception as exc:
        logger.warning("Vision analysis failed; using fallback. error=%s", exc)
        try:
            repaired = parse_json_object(str(exc))
            return validate_vision_analysis(repaired)
        except Exception:
            return dict(FALLBACK_ANALYSIS)


async def send_image_analysis_to_backend(payload: VisionAnalysisInput, ai_analysis: dict[str, Any]) -> Any:
    ai_summary = detailed_media_observation_summary(ai_analysis)
    data = {
        "careSeekerPhone": payload.care_seeker_phone,
        "source": payload.source or "whatsapp",
        "aiAnalysisJson": json.dumps(ai_analysis, ensure_ascii=True),
        "aiConfidence": str(ai_analysis["confidence"]),
        "aiSummary": ai_summary,
        "survivorFriendlySummary": ai_analysis["survivorFriendlySummary"],
    }
    optional_fields = {
        "caseId": payload.case_id,
        "incidentId": payload.incident_id,
        "sessionId": payload.session_id,
        "whatsappMessageId": payload.whatsapp_message_id,
        "whatsappMediaId": payload.whatsapp_media_id,
        "caption": payload.caption,
    }
    data.update({key: value for key, value in optional_fields.items() if value})
    logger.info(
        "[AI_IMAGE_ANALYSIS_NEST_UPLOAD_STARTED] endpoint=/internal/v1/case-notes/image-analysis fields=%s summary_chars=%s",
        sorted(data.keys()),
        len(ai_summary),
    )
    response = await nest_internal_client.upload_image_analysis_media_observation(
        data=data,
        file_name=payload.file_name,
        image_bytes=payload.image_bytes,
        mime_type=payload.mime_type,
    )
    logger.info("[AI_IMAGE_ANALYSIS_NEST_UPLOAD_COMPLETED] endpoint=/internal/v1/case-notes/image-analysis")
    return response


def validate_vision_analysis(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError("Vision analysis must be a JSON object.")
    analysis = {
        "visibleInjuryPresent": bool(value.get("visibleInjuryPresent")),
        "imageQuality": _enum(value.get("imageQuality"), IMAGE_QUALITY_VALUES, "poor"),
        "bodyPartVisible": _nullable_string(value.get("bodyPartVisible")),
        "apparentBodyAreaDetailed": _required_string(
            value.get("apparentBodyAreaDetailed"), FALLBACK_ANALYSIS["apparentBodyAreaDetailed"]
        ),
        "bodyAreaConfidence": _confidence(value.get("bodyAreaConfidence")),
        "possibleVisibleIndicators": _string_list(value.get("possibleVisibleIndicators")) or ["unclear"],
        "possibleInjuryTypes": _string_list(value.get("possibleInjuryTypes")) or ["unclear"],
        "possiblePatternResemblance": _string_list(value.get("possiblePatternResemblance")) or ["unclear"],
        "patternResemblanceRationale": _required_string(
            value.get("patternResemblanceRationale"), FALLBACK_ANALYSIS["patternResemblanceRationale"]
        ),
        "locationInImage": _required_string(value.get("locationInImage"), FALLBACK_ANALYSIS["locationInImage"]),
        "visibleMarkCountEstimate": _required_string(
            value.get("visibleMarkCountEstimate"), FALLBACK_ANALYSIS["visibleMarkCountEstimate"]
        ),
        "relativeSizeEstimate": _required_string(value.get("relativeSizeEstimate"), FALLBACK_ANALYSIS["relativeSizeEstimate"]),
        "edgeBoundaryObservation": _required_string(
            value.get("edgeBoundaryObservation"), FALLBACK_ANALYSIS["edgeBoundaryObservation"]
        ),
        "colorAndPatternObservation": _required_string(value.get("colorAndPatternObservation"), FALLBACK_ANALYSIS["colorAndPatternObservation"]),
        "shapeSizeAndDistributionObservation": _required_string(value.get("shapeSizeAndDistributionObservation"), FALLBACK_ANALYSIS["shapeSizeAndDistributionObservation"]),
        "surfaceConditionObservation": _required_string(value.get("surfaceConditionObservation"), FALLBACK_ANALYSIS["surfaceConditionObservation"]),
        "surroundingSkinObservation": _required_string(
            value.get("surroundingSkinObservation"), FALLBACK_ANALYSIS["surroundingSkinObservation"]
        ),
        "imageQualityLimitations": _string_list(value.get("imageQualityLimitations"))
        or list(FALLBACK_ANALYSIS["imageQualityLimitations"]),
        "documentationTags": _string_list(value.get("documentationTags")) or list(FALLBACK_ANALYSIS["documentationTags"]),
        "severityEstimate": _enum(value.get("severityEstimate"), SEVERITY_VALUES, "unknown"),
        "confidence": _confidence(value.get("confidence")),
        "concerningSigns": _string_list(value.get("concerningSigns")),
        "urgentCareRecommended": bool(value.get("urgentCareRecommended")),
        "nonMedicalDescription": _required_string(value.get("nonMedicalDescription"), FALLBACK_ANALYSIS["nonMedicalDescription"]),
        "professionalCaseNoteDescription": _required_string(value.get("professionalCaseNoteDescription"), FALLBACK_ANALYSIS["professionalCaseNoteDescription"]),
        "survivorFriendlySummary": _required_string(value.get("survivorFriendlySummary"), FALLBACK_ANALYSIS["survivorFriendlySummary"]),
        "recommendedFollowUpQuestions": _string_list(value.get("recommendedFollowUpQuestions")) or list(FALLBACK_ANALYSIS["recommendedFollowUpQuestions"]),
        "limitations": _string_list(value.get("limitations")) or list(FALLBACK_ANALYSIS["limitations"]),
        "safetyDisclaimer": _required_string(value.get("safetyDisclaimer"), FALLBACK_ANALYSIS["safetyDisclaimer"]),
    }
    if "medical diagnosis" not in analysis["safetyDisclaimer"].lower() or "legal conclusion" not in analysis["safetyDisclaimer"].lower():
        analysis["safetyDisclaimer"] = FALLBACK_ANALYSIS["safetyDisclaimer"]
    return analysis


def suggested_reply_for(ai_analysis: dict[str, Any]) -> str:
    if ai_analysis == FALLBACK_ANALYSIS or ai_analysis.get("confidence", 0) == 0:
        return "I've saved the image as a private media observation. I could not clearly analyze it right now, but you can describe what happened and I'll keep that with your case notes."
    if ai_analysis.get("urgentCareRecommended"):
        return "I've saved the image and added a private media observation. Some visible signs may need urgent attention. If you are badly hurt or in immediate danger, please contact local emergency services or a trusted nearby person now. Are you safe to continue chatting?"
    if ai_analysis.get("visibleInjuryPresent"):
        return "I can see visible marks in the image and I've added a private media observation. I can't diagnose injuries from a photo, but I can help document what is visible. Are you in immediate danger or severe pain right now?"
    return "I've saved the image as a private media observation. I couldn't clearly identify visible injury marks from this photo, but you can describe what happened and I'll keep that with your case notes."


def detailed_media_observation_summary(ai_analysis: dict[str, Any]) -> str:
    tags = ", ".join(ai_analysis.get("documentationTags") or []) or "none"
    limitations = "; ".join(ai_analysis.get("imageQualityLimitations") or []) or "none stated"
    body_part = ai_analysis.get("bodyPartVisible") or "unclear"
    pattern_resemblance = ", ".join(ai_analysis.get("possiblePatternResemblance") or []) or "unclear"
    possible_indicators = ", ".join(ai_analysis.get("possibleVisibleIndicators") or []) or "unclear"
    possible_injury_types = ", ".join(ai_analysis.get("possibleInjuryTypes") or []) or "unclear"
    concerning_signs = ", ".join(ai_analysis.get("concerningSigns") or []) or "none visible from image/context"
    follow_up = "; ".join(ai_analysis.get("recommendedFollowUpQuestions") or []) or "none suggested"

    sections = [
        ("Overview", ai_analysis["professionalCaseNoteDescription"]),
        (
            "Visible area",
            f"Body area: {body_part}. Detail: {ai_analysis['apparentBodyAreaDetailed']} Body-area confidence: {ai_analysis['bodyAreaConfidence']}.",
        ),
        (
            "Image quality and framing",
            f"Quality: {ai_analysis['imageQuality']}. Location/framing: {ai_analysis['locationInImage']} Limitations: {limitations}.",
        ),
        (
            "Visible marks",
            f"Count estimate: {ai_analysis['visibleMarkCountEstimate']}. Relative size: {ai_analysis['relativeSizeEstimate']}. Visible indicators: {possible_indicators}.",
        ),
        (
            "Color and pattern",
            f"Color/pattern: {ai_analysis['colorAndPatternObservation']} Pattern resemblance: {pattern_resemblance}. Rationale: {ai_analysis['patternResemblanceRationale']}",
        ),
        (
            "Shape, edges, and surface",
            f"Shape/distribution: {ai_analysis['shapeSizeAndDistributionObservation']} Edges/boundaries: {ai_analysis['edgeBoundaryObservation']} Surface/surrounding area: {ai_analysis['surfaceConditionObservation']} {ai_analysis['surroundingSkinObservation']}",
        ),
        ("Non-diagnostic injury indicators", f"Possible types: {possible_injury_types}."),
        (
            "Safety and confidence",
            f"Concerning signs: {concerning_signs}. Severity estimate: {ai_analysis['severityEstimate']}. AI confidence: {ai_analysis['confidence']}. Urgent care recommended: {'yes' if ai_analysis.get('urgentCareRecommended') else 'no'}.",
        ),
        ("Follow-up questions", follow_up),
        ("Documentation tags", tags),
        ("Caution", ai_analysis["safetyDisclaimer"]),
    ]
    return "\n".join(f"{label}: {value}" for label, value in sections if str(value).strip())


# Backwards-compatible name for older callers/tests; image analysis is stored as media observation.
def detailed_case_note_summary(ai_analysis: dict[str, Any]) -> str:
    return detailed_media_observation_summary(ai_analysis)


def build_vision_prompt(caption: str | None = None, existing_case_note: str | None = None) -> str:
    context = []
    if caption:
        context.append(f"Caption/context from care seeker: {caption}")
    if existing_case_note:
        context.append(f"Existing case note context: {existing_case_note}")
    context_text = "\n".join(context) if context else "No caption or existing case note context was provided."
    return f"""You are an image documentation assistant for SakhiSafe, a domestic violence survivor-support platform.

Your task is to analyze the uploaded image for visible, non-diagnostic injury indicators and generate a detailed private media observation.

You must be visually detailed, trauma-informed, and medically and legally cautious.

Analyze:
- Whether visible injury-like marks are present.
- Image quality: blur, lighting, focus, distance, framing, obstruction, filters, shadows, cropping, or compression.
- Broad visible body area if apparent, for example forearm, upper arm, wrist, hand, face/cheek, neck, shoulder, torso, back, thigh, knee, lower leg, ankle, foot, or unclear.
- More detailed apparent body-area reasoning, including visible landmarks such as fingers, wrist crease, elbow curve, jawline, shoulder contour, knee, ankle, clothing edge, or why the area is unclear.
- Where the visible area appears in the image frame, for example center, upper left, lower right, partially cut off.
- Estimated number of distinct visible marks, using cautious ranges such as one, two to three, multiple, or unclear.
- Relative size compared with the visible body area, without exact measurement.
- Visible color patterns, for example redness, dark discoloration, yellow/purple discoloration, mixed coloration, bleeding-like red area, or no clear color change.
- Shape and distribution, for example localized, scattered, linear, curved, circular, patchy, clustered, diffuse, multiple marks, or unclear.
- Edges or boundaries, for example well-defined, blurred, irregular, fading, partially obscured, or unclear.
- Surface condition, for example swelling-like raised area, broken-skin-like area, abrasion-like area, burn-like area, scar-like area, wound dressing, moisture, crusting-like area, or no clear surface change.
- Surrounding visible area, for example redness nearby, discoloration around the mark, normal-appearing surrounding area, obstruction, or unclear.
- Possible visual pattern resemblance, only if visible features support it, using cautious labels such as bite-like pattern, strike-like mark, scrape-like mark, scratch-like lines, abrasion-like area, bruise-like discoloration, burn-like mark, healing/scar-like mark, pressure/friction-like mark, unclear, or not injury-like.
- Explain why a pattern label is or is not supported by visible shape, spacing, color, boundaries, distribution, and surface features.
- Whether urgent care may be needed based on visible serious signs or user-provided caption/context.
- What follow-up questions should be asked.
- Short documentation tags useful for case records, for example redness, discoloration, swelling-like, abrasion-like, bleeding-like, poor-quality, unclear.

Depth requirements:
- Do not be vague if visual details are available.
- Use separate observations for color, shape/distribution, boundary, surface, and surrounding visible area.
- Mention uncertainty and image limitations explicitly.
- Keep observations factual and visible-only.
- If no injury-like mark is visible, describe what limits that conclusion.
- Make professionalCaseNoteDescription 4 to 7 sentences and suitable for a private case record.
- Make nonMedicalDescription 2 to 4 survivor-safe sentences.
- Make survivorFriendlySummary short, gentle, and not alarming.

Context:
{context_text}

Strict safety rules:
- Do not identify the person.
- Do not infer age, gender, caste, religion, socioeconomic status, identity, or relationship.
- Do not say the injury was caused by abuse.
- Do not say this proves domestic violence.
- Do not say this proves assault.
- Do not provide medical diagnosis.
- Do not provide legal conclusion.
- Do not estimate exact wound age.
- Do not infer weapon, object, or exact cause.
- Do not say a mark is a bite, strike, assault, slap, punch, burn, or scar as a fact.
- You may say visual features are bite-like, strike-like, scratch-like, scrape-like, abrasion-like, burn-like, scar-like, or unclear when supported, and explain the visible basis.
- Do not use definitive language like definitely, certainly, confirmed, proof.
- Use cautious language: appears, may be consistent with, visible signs suggest, image quality limits certainty.
- If the image is unclear or not an injury image, say so and keep confidence low.
- Return only valid JSON. No markdown. No explanation outside JSON.

Return JSON exactly matching this schema:
{{
  "visibleInjuryPresent": boolean,
  "imageQuality": "poor" | "fair" | "good",
  "bodyPartVisible": string | null,
  "apparentBodyAreaDetailed": string,
  "bodyAreaConfidence": number,
  "possibleVisibleIndicators": string[],
  "possibleInjuryTypes": string[],
  "possiblePatternResemblance": string[],
  "patternResemblanceRationale": string,
  "locationInImage": string,
  "visibleMarkCountEstimate": string,
  "relativeSizeEstimate": string,
  "edgeBoundaryObservation": string,
  "colorAndPatternObservation": string,
  "shapeSizeAndDistributionObservation": string,
  "surfaceConditionObservation": string,
  "surroundingSkinObservation": string,
  "imageQualityLimitations": string[],
  "documentationTags": string[],
  "severityEstimate": "low" | "medium" | "high" | "unknown",
  "confidence": number,
  "concerningSigns": string[],
  "urgentCareRecommended": boolean,
  "nonMedicalDescription": string,
  "professionalCaseNoteDescription": string,
  "survivorFriendlySummary": string,
  "recommendedFollowUpQuestions": string[],
  "limitations": string[],
  "safetyDisclaimer": string
}}"""


def _validate_input(payload: VisionAnalysisInput) -> None:
    if not payload.image_bytes:
        raise ValueError("Image file is required.")
    if not payload.mime_type.startswith("image/"):
        raise ValueError("File MIME type must be image/*.")
    if len(payload.image_bytes) > settings.vision_max_image_bytes:
        raise ValueError("Image exceeds VISION_MAX_IMAGE_BYTES.")
    if not payload.care_seeker_phone:
        raise ValueError("careSeekerPhone is required.")


def _enum(value: Any, allowed: set[str], default: str) -> str:
    normalized = str(value or default).strip().lower()
    return normalized if normalized in allowed else default


def _nullable_string(value: Any) -> str | None:
    cleaned = str(value or "").strip()
    return cleaned or None


def _required_string(value: Any, default: str) -> str:
    cleaned = str(value or "").strip()
    return cleaned or default


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _confidence(value: Any) -> float:
    try:
        return max(0.0, min(1.0, float(value)))
    except (TypeError, ValueError):
        return 0.0

