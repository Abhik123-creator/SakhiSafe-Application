import logging
import os

from google import genai
from google.genai import types


logger = logging.getLogger("sakhi-ai-service.vertex-gemini-client")

SAKHISAFE_SYSTEM_INSTRUCTION = """
You are SakhiSafe, a trauma-informed WhatsApp safety assistant for women facing abuse or unsafe situations.

Core behavior:
- Be calm, human, and supportive.
- Keep replies short enough for WhatsApp.
- Never sound robotic, legalistic, or police-like.
- Never blame the user.
- Do not overreact to mild messages.
- If the user seems in immediate danger, prioritize emergency safety.
- Ask one helpful question at a time.
- Avoid robotic phrases like "I understand your concern."
- Do not claim to be a lawyer, therapist, police, or emergency service.
- Do not give fake legal certainty.
- Encourage safety planning.
- If the user is in India and seems in immediate danger, suggest calling 112.
- If the message is casual, reply casually and naturally.
- If the message is about abuse, fear, stalking, threats, coercion, physical violence, financial control, or isolation, respond with empathy and safety-first guidance.
""".strip()

SAFE_EMPTY_RESPONSE = (
    "I could not generate a proper reply right now. Please try again in a moment. "
    "If you are in immediate danger, contact local emergency services or someone trusted now."
)


class GeminiClient:
    def __init__(self) -> None:
        self.model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        self.project = os.getenv("GOOGLE_CLOUD_PROJECT")
        self.location = os.getenv("GOOGLE_CLOUD_LOCATION", "global")
        if not self.project:
            raise ValueError("GOOGLE_CLOUD_PROJECT is required for Vertex AI Gemini.")

        self.client = genai.Client(
            vertexai=True,
            project=self.project,
            location=self.location,
        )
        logger.info(
            "Initialized Vertex AI Gemini helper model=%s project=%s location=%s",
            self.model,
            self.project,
            self.location,
        )

    def generate_reply(self, user_message: str) -> str:
        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=user_message,
                config=types.GenerateContentConfig(
                    system_instruction=SAKHISAFE_SYSTEM_INSTRUCTION,
                    max_output_tokens=int(os.getenv("LLM_MAX_OUTPUT_TOKENS", "700")),
                    temperature=float(os.getenv("LLM_AGENT_TEMPERATURE", "0.7")),
                ),
            )
            return response.text or SAFE_EMPTY_RESPONSE
        except Exception as exc:
            logger.exception("Vertex AI Gemini reply generation failed. error=%s", type(exc).__name__)
            return SAFE_EMPTY_RESPONSE
