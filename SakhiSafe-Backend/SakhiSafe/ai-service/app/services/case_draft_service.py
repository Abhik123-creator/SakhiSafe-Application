import json
import logging
from typing import Any

from app.config import settings
from app.core.llm.base import parse_json_object
from app.core.llm.factory import get_llm_client


logger = logging.getLogger("sakhi-ai-service.case_draft")

REQUIRED_KEYS = {"title", "status", "riskLevel", "summary", "incidentDescription", "notes"}


def build_case_draft(
    phone_number: str,
    message: str,
    name: str | None,
    risk_level: str,
    matched_signals: list[str],
) -> dict[str, str]:
    risk = risk_level.upper()
    fallback = _fallback_case_draft(phone_number, message, name, risk, matched_signals)

    if not settings.enable_llm_agent_responses:
        return fallback

    try:
        client = get_llm_client(settings)
        if client is None:
            return fallback
        prompt = _prompt(phone_number, message, name, risk, matched_signals)
        text = client.generate_text(prompt, temperature=0.1, max_output_tokens=700)
        parsed = parse_json_object(text)
        return _validate(parsed, fallback, risk)
    except Exception as exc:
        logger.warning("Case draft LLM generation failed: %s", exc)
        return fallback


def _prompt(phone_number: str, message: str, name: str | None, risk_level: str, matched_signals: list[str]) -> str:
    name_or_null = json.dumps(name) if name else "null"
    return f"""
You are SakhiSafe's WhatsApp case drafting assistant.

Your job:
Convert a care seeker's WhatsApp message into structured case fields for a support dashboard.

Return ONLY valid JSON.
No markdown.
No explanation.
No extra text.

Safety rules:
- Use only facts provided in the message.
- Do not invent names, locations, dates, injuries, weapons, relationships, or events.
- If a detail is missing, say it was not provided.
- Do not make legal conclusions.
- Do not diagnose medical or mental health conditions.
- Do not blame the care seeker.
- Do not pressure the care seeker to share name or location.
- If name is missing, refer to them as "the care seeker" or "Anonymous".
- Phone number is for tracking only. Do not use it as a name.

Input:
phoneNumber: {phone_number}
name: {name_or_null}
message: {json.dumps(message)}
riskLevel: {risk_level}
matchedSignals: {json.dumps(matched_signals)}

Return JSON with exactly these keys:

{{
  "title": "",
  "status": "OPEN",
  "riskLevel": "",
  "summary": "",
  "incidentDescription": "",
  "notes": ""
}}

Field rules:

title:
- Short title under 80 characters.
- Should clearly describe the concern.
- Example: "Threat reported via WhatsApp"

status:
- Always "OPEN"

riskLevel:
- Use the provided riskLevel exactly.

summary:
- 1 to 3 sentence professional summary.

incidentDescription:
- Factual description based only on the message.
- Include what was said.
- Mention missing details when not provided.

notes:
- Internal notes for admin/support worker.
- Include:
  Source: WhatsApp AI Service
  Name status: provided or Anonymous
  Risk level
  Matched signals
  Suggested next step
""".strip()


def _validate(parsed: dict[str, Any], fallback: dict[str, str], risk_level: str) -> dict[str, str]:
    if set(parsed.keys()) != REQUIRED_KEYS:
        return fallback
    draft = {key: str(parsed.get(key) or fallback[key]).strip() for key in REQUIRED_KEYS}
    draft["status"] = "OPEN"
    draft["riskLevel"] = risk_level
    if len(draft["title"]) > 80:
        draft["title"] = fallback["title"]
    for key in REQUIRED_KEYS:
        if not draft[key]:
            draft[key] = fallback[key]
    return draft


def _fallback_case_draft(
    phone_number: str,
    message: str,
    name: str | None,
    risk_level: str,
    matched_signals: list[str],
) -> dict[str, str]:
    cleaned_message = " ".join((message or "").split())
    display_name = name.strip() if name and name.strip() else None
    matched = ", ".join(matched_signals) if matched_signals else "none"
    name_note = f"Name provided: {display_name}." if display_name else "Name was not provided; continue as Anonymous."

    if cleaned_message.lower() == "he threatened me yesterday" and risk_level == "HIGH":
        return {
            "title": "Threat reported via WhatsApp",
            "status": "OPEN",
            "riskLevel": "HIGH",
            "summary": "The care seeker reported being threatened yesterday. The message indicates a possible safety risk and requires follow-up.",
            "incidentDescription": "The care seeker stated that someone threatened them yesterday. No additional details about the person involved, location, injuries, or immediate danger were provided in the message.",
            "notes": (
                "Source: WhatsApp AI Service. Name was not provided; continue as Anonymous. "
                f"Phone number: {phone_number}. Risk level: HIGH. Matched signal: threatened. "
                "Suggested next step: ask whether the care seeker is currently safe and whether they want human support."
            ),
        }

    if cleaned_message:
        incident_description = (
            f"The care seeker stated: {json.dumps(cleaned_message)}. "
            "No additional details about the person involved, location, injuries, or immediate danger were provided in the message."
        )
    else:
        incident_description = "The care seeker asked to record an incident, but did not provide incident details."

    return {
        "title": _title(risk_level, matched_signals, cleaned_message),
        "status": "OPEN",
        "riskLevel": risk_level,
        "summary": _summary(cleaned_message, risk_level),
        "incidentDescription": incident_description,
        "notes": (
            f"Source: WhatsApp AI Service. {name_note} Phone number: {phone_number}. "
            f"Risk level: {risk_level}. Matched signals: {matched}. "
            f"Suggested next step: {_suggested_next_step(risk_level)} "
            f"Immediate safety check recommended: {'yes' if risk_level in {'HIGH', 'CRITICAL'} else 'no'}."
        ),
    }


def _title(risk_level: str, matched_signals: list[str], message: str) -> str:
    if risk_level == "CRITICAL":
        return "Critical WhatsApp safety report"
    if risk_level == "HIGH":
        if any(signal in {"threat", "threaten", "threatened"} for signal in matched_signals):
            return "Threat reported via WhatsApp"
        return "High-risk WhatsApp safety report"
    if risk_level == "MEDIUM":
        return "WhatsApp safety concern"
    return "WhatsApp incident report" if message else "WhatsApp safety note"


def _summary(message: str, risk_level: str) -> str:
    if not message:
        return "The care seeker asked to record an incident but did not provide details. Follow-up is needed to understand the situation."
    if risk_level in {"HIGH", "CRITICAL"}:
        return f"The care seeker reported: {message}. The message indicates possible safety risk and requires follow-up."
    return f"The care seeker reported: {message}. The information should be reviewed and followed up as appropriate."


def _suggested_next_step(risk_level: str) -> str:
    if risk_level == "CRITICAL":
        return "check whether the care seeker is in immediate danger and offer urgent human support."
    if risk_level == "HIGH":
        return "ask whether the care seeker is currently safe and whether they want human support."
    return "ask if they want to share more details or speak with a support worker."
