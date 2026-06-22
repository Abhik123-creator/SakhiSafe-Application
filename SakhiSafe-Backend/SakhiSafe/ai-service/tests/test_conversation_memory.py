import unittest
from unittest.mock import patch

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.agents.coordinator import MessagingResponse, process_agent_message
from app.agents.evidence_agent import run as run_evidence_agent
from app.agents.supervisor import keyword_route_message, route_message
from app.config import settings
from app.core.conversation_intent import resolve_pending_intent
from app.core.llm.factory import get_llm_client
from app.core.llm.safe_generate import generate_safe_reply_result
from app.core.simple_extractors import extract_relative_date
from app.db.models import Base, Conversation
from app.services.conversation_service import (
    clear_pending_intent,
    get_conversation_history,
    get_or_create_conversation,
    save_message,
)
from app.tools.evidence_tools import create_incident, get_latest_incident


class ConversationMemoryTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        self.sessionmaker = async_sessionmaker(self.engine, expire_on_commit=False)

    async def asyncTearDown(self) -> None:
        await self.engine.dispose()

    async def test_same_phone_reuses_one_conversation(self) -> None:
        async with self.sessionmaker() as session:
            first = await get_or_create_conversation(session, "917003801171", "whatsapp", "917003801171", "User")
            second = await get_or_create_conversation(session, "917003801171", "whatsapp", "917003801171", "User")
            self.assertEqual(first.id, second.id)

    def test_anthropic_provider_factory_uses_claude_client(self) -> None:
        class AnthropicSettings:
            LLM_PROVIDER = "anthropic"
            LLM_API_KEY = "test-key"
            LLM_MODEL = "claude-sonnet-4-5"
            ANTHROPIC_API_KEY = ""
            ANTHROPIC_MODEL = ""

        client = get_llm_client(AnthropicSettings())
        self.assertEqual(client.__class__.__name__, "AnthropicLLMClient")

    def test_claude_provider_alias_uses_claude_client(self) -> None:
        class ClaudeSettings:
            LLM_PROVIDER = "claude"
            LLM_API_KEY = "test-key"
            LLM_MODEL = "claude-sonnet-4-5"
            ANTHROPIC_API_KEY = ""
            ANTHROPIC_MODEL = ""

        client = get_llm_client(ClaudeSettings())
        self.assertEqual(client.__class__.__name__, "AnthropicLLMClient")

    def test_gemini_provider_uses_vertex_client(self) -> None:
        class GeminiSettings:
            LLM_PROVIDER = "gemini"
            LLM_API_KEY = ""
            LLM_MODEL = "gemini-2.5-flash"
            GEMINI_MODEL = "gemini-2.5-flash"
            GOOGLE_CLOUD_PROJECT = "test-project"
            GOOGLE_CLOUD_LOCATION = "global"

        with patch("app.core.llm.gemini.genai.Client") as client_class:
            client = get_llm_client(GeminiSettings())

        self.assertEqual(client.__class__.__name__, "GeminiLLMClient")
        client_class.assert_called_once_with(vertexai=True, project="test-project", location="global")

    def test_long_llm_reply_is_not_trimmed(self) -> None:
        class FakeClient:
            def generate_text(self, prompt: str, **kwargs) -> str:
                return (
                    "First complete sentence. Second complete sentence with useful advice. "
                    "This final part is too long and should not be cut in the middle of a thought."
                )

        old_enabled = settings.enable_llm_agent_responses
        object.__setattr__(settings, "enable_llm_agent_responses", True)
        try:
            with patch("app.core.llm.safe_generate.get_llm_client", return_value=FakeClient()):
                result = generate_safe_reply_result(settings, "prompt", "fallback", max_chars=75)
        finally:
            object.__setattr__(settings, "enable_llm_agent_responses", old_enabled)

        self.assertFalse(result.used_fallback)
        self.assertEqual(
            result.reply,
            "First complete sentence. Second complete sentence with useful advice. "
            "This final part is too long and should not be cut in the middle of a thought.",
        )

    def test_incomplete_llm_reply_returns_temporary_error(self) -> None:
        class FakeClient:
            def generate_text(self, prompt: str, **kwargs) -> str:
                return "This reply has no useful stopping point and it keeps going with"

        old_enabled = settings.enable_llm_agent_responses
        object.__setattr__(settings, "enable_llm_agent_responses", True)
        try:
            with patch("app.core.llm.safe_generate.get_llm_client", return_value=FakeClient()):
                result = generate_safe_reply_result(settings, "prompt", "fallback", max_chars=45)
        finally:
            object.__setattr__(settings, "enable_llm_agent_responses", old_enabled)

        self.assertFalse(result.used_fallback)
        self.assertIn("can't generate a proper reply right now", result.reply.lower())
        self.assertEqual(result.error, "incomplete_llm_reply")

    def test_incomplete_question_fragment_returns_temporary_error(self) -> None:
        class FakeClient:
            def generate_text(self, prompt: str, **kwargs) -> str:
                return "I'm here with you. Is there"

        old_enabled = settings.enable_llm_agent_responses
        object.__setattr__(settings, "enable_llm_agent_responses", True)
        try:
            with patch("app.core.llm.safe_generate.get_llm_client", return_value=FakeClient()):
                result = generate_safe_reply_result(settings, "prompt", "fallback")
        finally:
            object.__setattr__(settings, "enable_llm_agent_responses", old_enabled)

        self.assertFalse(result.used_fallback)
        self.assertIn("can't generate a proper reply right now", result.reply.lower())
        self.assertEqual(result.error, "incomplete_llm_reply")

    def test_incomplete_trusted_person_fragment_returns_temporary_error(self) -> None:
        class FakeClient:
            def generate_text(self, prompt: str, **kwargs) -> str:
                return "I can't show past incidents, but your safety right now is most important.\n\nIs there one trusted person you"

        old_enabled = settings.enable_llm_agent_responses
        object.__setattr__(settings, "enable_llm_agent_responses", True)
        try:
            with patch("app.core.llm.safe_generate.get_llm_client", return_value=FakeClient()):
                result = generate_safe_reply_result(settings, "prompt", "fallback")
        finally:
            object.__setattr__(settings, "enable_llm_agent_responses", old_enabled)

        self.assertIn("can't generate a proper reply right now", result.reply.lower())
        self.assertEqual(result.error, "incomplete_llm_reply")

    def test_known_incomplete_fragment_returns_temporary_error(self) -> None:
        class FakeClient:
            def generate_text(self, prompt: str, **kwargs) -> str:
                return "I hear you. My main concern is making sure you"

        old_enabled = settings.enable_llm_agent_responses
        object.__setattr__(settings, "enable_llm_agent_responses", True)
        try:
            with patch("app.core.llm.safe_generate.get_llm_client", return_value=FakeClient()):
                result = generate_safe_reply_result(settings, "prompt", "fallback")
        finally:
            object.__setattr__(settings, "enable_llm_agent_responses", old_enabled)

        self.assertIn("can't generate a proper reply right now", result.reply.lower())
        self.assertEqual(result.error, "incomplete_llm_reply")

    def test_short_reply_without_terminal_punctuation_is_allowed(self) -> None:
        class FakeClient:
            def generate_text(self, prompt: str, **kwargs) -> str:
                return "Hi, I am here with you"

        old_enabled = settings.enable_llm_agent_responses
        object.__setattr__(settings, "enable_llm_agent_responses", True)
        try:
            with patch("app.core.llm.safe_generate.get_llm_client", return_value=FakeClient()):
                result = generate_safe_reply_result(settings, "prompt", "fallback")
        finally:
            object.__setattr__(settings, "enable_llm_agent_responses", old_enabled)

        self.assertEqual(result.reply, "Hi, I am here with you")
        self.assertIsNone(result.error)

    async def test_history_returns_latest_12_oldest_to_newest(self) -> None:
        async with self.sessionmaker() as session:
            conversation = await get_or_create_conversation(session, "917003801171", "whatsapp")
            for index in range(14):
                await save_message(session, conversation.id, "user", f"m{index}")
            history = await get_conversation_history(session, conversation.id, limit=12)
            self.assertEqual(len(history), 12)
            self.assertEqual(history[0], {"role": "user", "content": "m2"})
            self.assertEqual(history[-1], {"role": "user", "content": "m13"})

    async def test_current_user_message_is_included_in_history(self) -> None:
        async with self.sessionmaker() as session:
            conversation = await get_or_create_conversation(session, "917003801171", "whatsapp")
            await save_message(session, conversation.id, "user", "current")
            history = await get_conversation_history(session, conversation.id, limit=12)
            self.assertEqual(history[-1], {"role": "user", "content": "current"})

    async def test_affirmative_pending_intent_routes(self) -> None:
        conversation = Conversation(
            thread_id="917003801171",
            source="whatsapp",
            pending_intent="safety_planning_agent",
            pending_question="confirm_safety_plan",
        )
        self.assertEqual(resolve_pending_intent(conversation, "Yes please")["agent"], "safety_planning_agent")

    async def test_negative_pending_intent_cancels(self) -> None:
        async with self.sessionmaker() as session:
            conversation = await get_or_create_conversation(session, "917003801171", "whatsapp")
            conversation.pending_intent = "safety_planning_agent"
            conversation.pending_question = "confirm_safety_plan"
            resolution = resolve_pending_intent(conversation, "No not now")
            self.assertEqual(resolution["action"], "cancel")
            await clear_pending_intent(session, conversation.id)
            self.assertIsNone(conversation.pending_intent)

    async def test_pending_yes_routes_to_safety_planning_agent(self) -> None:
        async with self.sessionmaker() as session:
            conversation = await get_or_create_conversation(session, "917003801171", "whatsapp")
            conversation.pending_intent = "safety_planning_agent"
            conversation.pending_question = "confirm_safety_plan"
            conversation.last_agent = "abuse_pattern_agent"
            conversation.last_risk_level = "medium"
            with patch(
                "app.agents.safety_planning_agent.generate_agent_reply",
                return_value="We can make a simple safety plan.",
            ):
                result = await process_agent_message(
                    thread_id="917003801171",
                    sender_name="User",
                    message_text="Yes please",
                    recent_messages=[
                        {"role": "assistant", "content": "Would you like help making a simple safety plan?"},
                        {"role": "user", "content": "Yes please"},
                    ],
                    db=session,
                    conversation=conversation,
                )
            self.assertEqual(result["agent"], "safety_planning_agent")

    def test_sexual_abuse_routes_crisis(self) -> None:
        decision = keyword_route_message("My husband sexually abuses me")
        self.assertEqual(decision["agent"], "crisis_agent")

    def test_rape_hit_cigarette_routes_critical_crisis(self) -> None:
        decision = keyword_route_message("My husband raped me and hit me with cigarette")
        self.assertEqual(decision["agent"], "crisis_agent")
        self.assertEqual(decision["risk_level"], "critical")

    async def test_crisis_disclosure_without_llm_returns_unavailable(self) -> None:
        old_enabled = settings.enable_llm_agent_responses
        object.__setattr__(settings, "enable_llm_agent_responses", False)
        try:
            result = await process_agent_message(
                thread_id="917003801171",
                sender_name="User",
                message_text="My husband raped me and hit me with cigarette",
                recent_messages=[{"role": "user", "content": "My husband raped me and hit me with cigarette"}],
            )
        finally:
            object.__setattr__(settings, "enable_llm_agent_responses", old_enabled)
        self.assertEqual(result["agent"], "crisis_agent")
        self.assertEqual(result["risk_level"], "critical")
        self.assertIn("can't generate a proper reply right now", result["reply"].lower())
        self.assertNotIn("ask for a safety plan", result["reply"].lower())

    async def test_crisis_pending_yes_asks_clarification(self) -> None:
        conversation = Conversation(
            thread_id="917003801171",
            source="whatsapp",
            pending_intent="crisis_agent",
            pending_question="confirm_abuser_nearby",
            last_agent="crisis_agent",
            last_risk_level="critical",
        )
        old_enabled = settings.enable_llm_agent_responses
        object.__setattr__(settings, "enable_llm_agent_responses", False)
        try:
            result = await process_agent_message(
                thread_id="917003801171",
                sender_name="User",
                message_text="Yes",
                recent_messages=[
                    {"role": "assistant", "content": "Are they near you right now?"},
                    {"role": "user", "content": "Yes"},
                ],
                conversation=conversation,
                previous_assistant_message="Are they near you right now?",
            )
        finally:
            object.__setattr__(settings, "enable_llm_agent_responses", old_enabled)
        self.assertEqual(result["agent"], "crisis_agent")
        self.assertIn("can't generate a proper reply right now", result["reply"].lower())

    async def test_crisis_not_near_moves_to_safe_now_planning(self) -> None:
        conversation = Conversation(
            thread_id="917003801171",
            source="whatsapp",
            pending_intent="crisis_agent",
            pending_question="confirm_abuser_nearby",
            last_agent="crisis_agent",
            last_risk_level="critical",
        )
        old_enabled = settings.enable_llm_agent_responses
        object.__setattr__(settings, "enable_llm_agent_responses", False)
        try:
            result = await process_agent_message(
                thread_id="917003801171",
                sender_name="User",
                message_text="no they are not near me",
                recent_messages=[{"role": "user", "content": "no they are not near me"}],
                conversation=conversation,
            )
        finally:
            object.__setattr__(settings, "enable_llm_agent_responses", old_enabled)
        reply = result["reply"].lower()
        self.assertEqual(result["agent"], "crisis_agent")
        self.assertIn("can't generate a proper reply right now", reply)
        self.assertEqual(result["crisis_stage"], "safe_now_planning")

    async def test_crisis_help_me_what_to_do_stays_crisis(self) -> None:
        conversation = Conversation(
            thread_id="917003801171",
            source="whatsapp",
            last_agent="crisis_agent",
            last_risk_level="critical",
        )
        old_enabled = settings.enable_llm_agent_responses
        object.__setattr__(settings, "enable_llm_agent_responses", False)
        try:
            result = await process_agent_message(
                thread_id="917003801171",
                sender_name="User",
                message_text="Help me what to do",
                recent_messages=[{"role": "user", "content": "Help me what to do"}],
                conversation=conversation,
            )
        finally:
            object.__setattr__(settings, "enable_llm_agent_responses", old_enabled)
        self.assertEqual(result["agent"], "crisis_agent")
        reply = result["reply"].lower()
        self.assertIn("can't generate a proper reply right now", reply)

    async def test_crisis_give_me_answer_not_general(self) -> None:
        conversation = Conversation(
            thread_id="917003801171",
            source="whatsapp",
            last_agent="crisis_agent",
            last_risk_level="critical",
        )
        old_enabled = settings.enable_llm_agent_responses
        object.__setattr__(settings, "enable_llm_agent_responses", False)
        try:
            result = await process_agent_message(
                thread_id="917003801171",
                sender_name="User",
                message_text="Give me answer what to do",
                recent_messages=[{"role": "user", "content": "Give me answer what to do"}],
                conversation=conversation,
            )
        finally:
            object.__setattr__(settings, "enable_llm_agent_responses", old_enabled)
        self.assertEqual(result["agent"], "crisis_agent")
        self.assertIn("can't generate a proper reply right now", result["reply"].lower())

    async def test_crisis_pending_does_not_capture_evidence_request(self) -> None:
        conversation = Conversation(
            thread_id="917003801171",
            source="whatsapp",
            pending_intent="crisis_agent",
            pending_question="confirm_abuser_nearby",
            last_agent="crisis_agent",
            last_risk_level="critical",
        )
        with patch("app.agents.evidence_agent.generate_agent_reply", side_effect=lambda **kwargs: kwargs["fallback"]):
            result = await process_agent_message(
                thread_id="917003801171",
                sender_name="User",
                message_text="show all incidents i logged",
                recent_messages=[{"role": "user", "content": "show all incidents i logged"}],
                conversation=conversation,
            )
        self.assertEqual(result["agent"], "evidence_agent")

    async def test_crisis_pending_does_not_capture_unrelated_code_request(self) -> None:
        conversation = Conversation(
            thread_id="917003801171",
            source="whatsapp",
            pending_intent="crisis_agent",
            pending_question="confirm_abuser_nearby",
            last_agent="crisis_agent",
            last_risk_level="critical",
        )
        old_enabled = settings.enable_llm_agent_responses
        object.__setattr__(settings, "enable_llm_agent_responses", False)
        try:
            result = await process_agent_message(
                thread_id="917003801171",
                sender_name="User",
                message_text="write a python code to add number",
                recent_messages=[{"role": "user", "content": "write a python code to add number"}],
                conversation=conversation,
            )
        finally:
            object.__setattr__(settings, "enable_llm_agent_responses", old_enabled)
        self.assertNotEqual(result["agent"], "crisis_agent")

    async def test_crisis_escape_plan_from_in_laws_gets_quiet_plan(self) -> None:
        old_enabled = settings.enable_llm_agent_responses
        object.__setattr__(settings, "enable_llm_agent_responses", False)
        try:
            result = await process_agent_message(
                thread_id="917003801171",
                sender_name="User",
                message_text="please give me escape plan from my in laws everyone beats me up every day",
                recent_messages=[{"role": "user", "content": "please give me escape plan from my in laws everyone beats me up every day"}],
            )
        finally:
            object.__setattr__(settings, "enable_llm_agent_responses", old_enabled)
        reply = result["reply"].lower()
        self.assertEqual(result["agent"], "crisis_agent")
        self.assertIn(result["risk_level"], {"high", "critical"})
        self.assertIn("can't generate a proper reply right now", reply)

    async def test_history_count_increases_for_same_sender(self) -> None:
        async with self.sessionmaker() as session:
            conversation = await get_or_create_conversation(session, "917003801171", "whatsapp")
            await save_message(session, conversation.id, "user", "Hi")
            first_history = await get_conversation_history(session, conversation.id, limit=12)
            same_conversation = await get_or_create_conversation(session, "917003801171", "whatsapp")
            await save_message(session, same_conversation.id, "user", "Help me what to do")
            second_history = await get_conversation_history(session, same_conversation.id, limit=12)
            self.assertEqual(conversation.id, same_conversation.id)
            self.assertEqual(len(first_history), 1)
            self.assertEqual(len(second_history), 2)

    def test_llm_supervisor_failure_falls_back_to_crisis_keywords(self) -> None:
        old_enabled = settings.enable_llm_supervisor
        object.__setattr__(settings, "enable_llm_supervisor", True)
        try:
            with patch("app.agents.supervisor.get_llm_client", side_effect=RuntimeError("boom")):
                decision = route_message("My husband raped me and hit me with cigarette")
        finally:
            object.__setattr__(settings, "enable_llm_supervisor", old_enabled)
        self.assertEqual(decision["agent"], "crisis_agent")
        self.assertEqual(decision["risk_level"], "critical")

    async def test_crisis_llm_failure_returns_unavailable(self) -> None:
        old_enabled = settings.enable_llm_agent_responses
        object.__setattr__(settings, "enable_llm_agent_responses", True)
        try:
            with patch("app.core.llm.safe_generate.get_llm_client", side_effect=RuntimeError("boom")):
                result = await process_agent_message(
                    thread_id="917003801171",
                    sender_name="User",
                    message_text="My husband raped me and hit me with cigarette",
                    recent_messages=[{"role": "user", "content": "My husband raped me and hit me with cigarette"}],
                )
        finally:
            object.__setattr__(settings, "enable_llm_agent_responses", old_enabled)
        self.assertEqual(result["agent"], "crisis_agent")
        self.assertIn("can't generate a proper reply right now", result["reply"].lower())
        self.assertFalse(result["used_crisis_playbook"])
        self.assertEqual(result["llm_agent_error"], "RuntimeError")
        self.assertNotIn("ask for a safety plan", result["reply"].lower())

    def test_show_incidents_routes_evidence(self) -> None:
        decision = keyword_route_message("show incidents that are already logged by me")
        self.assertEqual(decision["agent"], "evidence_agent")

    def test_fetch_logged_incidents_routes_evidence(self) -> None:
        decision = keyword_route_message("fetch logged incidents")
        self.assertEqual(decision["agent"], "evidence_agent")

    def test_log_it_routes_evidence(self) -> None:
        decision = keyword_route_message("log it")
        self.assertEqual(decision["agent"], "evidence_agent")

    def test_record_routes_evidence(self) -> None:
        decision = keyword_route_message("record")
        self.assertEqual(decision["agent"], "evidence_agent")

    def test_add_date_location_routes_evidence(self) -> None:
        decision = keyword_route_message("add date yesterday location mahestala kolkata")
        self.assertEqual(decision["agent"], "evidence_agent")

    async def test_update_latest_incident_date_and_location(self) -> None:
        async with self.sessionmaker() as session:
            await create_incident(session, 1, "threat", "critical", "save this he threatened me")
            with patch("app.agents.evidence_agent.generate_agent_reply", side_effect=lambda **kwargs: kwargs["fallback"]):
                result = await run_evidence_agent(
                    thread_id="917003801171",
                    sender_name="User",
                    message_text="add date yesterday location mahestala kolkata",
                    db=session,
                    user_id=1,
                )
            latest = await get_latest_incident(session, 1)
            self.assertEqual(result["agent"], "evidence_agent")
            self.assertIn("can't generate a proper reply right now", result["reply"].lower())
            self.assertEqual(latest.incident_date, extract_relative_date("yesterday"))
            self.assertEqual(latest.location, "mahestala kolkata")

    async def test_update_latest_incident_no_incident(self) -> None:
        async with self.sessionmaker() as session:
            with patch("app.agents.evidence_agent.generate_agent_reply", side_effect=lambda **kwargs: kwargs["fallback"]):
                result = await run_evidence_agent(
                    thread_id="917003801171",
                    sender_name="User",
                    message_text="add date yesterday location mahestala kolkata",
                    db=session,
                    user_id=1,
                )
            self.assertIn("can't generate a proper reply right now", result["reply"].lower())

    async def test_list_incidents_safely(self) -> None:
        async with self.sessionmaker() as session:
            await create_incident(session, 1, "physical", "high", "save this he slapped me")
            await create_incident(session, 1, "threat", "critical", "save this he threatened me")
            with patch("app.agents.evidence_agent.generate_agent_reply", side_effect=lambda **kwargs: kwargs["fallback"]):
                result = await run_evidence_agent(
                    thread_id="917003801171",
                    sender_name="User",
                    message_text="show incidents that are already logged by me",
                    db=session,
                    user_id=1,
                )
            self.assertIn("can't generate a proper reply right now", result["reply"].lower())

    async def test_log_it_uses_previous_user_message(self) -> None:
        async with self.sessionmaker() as session:
            with patch("app.agents.evidence_agent.generate_agent_reply", side_effect=lambda **kwargs: kwargs["fallback"]):
                result = await run_evidence_agent(
                    thread_id="917003801171",
                    sender_name="User",
                    message_text="log it",
                    db=session,
                    user_id=1,
                    recent_messages=[
                        {"role": "user", "content": "He threatened me yesterday"},
                        {"role": "user", "content": "log it"},
                    ],
                )
            incident = await get_latest_incident(session, 1)
            self.assertEqual(result["agent"], "evidence_agent")
            self.assertEqual(incident.description, "He threatened me yesterday")

    async def test_record_without_details_still_saves_minimal_incident(self) -> None:
        async with self.sessionmaker() as session:
            with patch("app.agents.evidence_agent.generate_agent_reply", side_effect=lambda **kwargs: kwargs["fallback"]):
                result = await run_evidence_agent(
                    thread_id="917003801171",
                    sender_name="User",
                    message_text="record",
                    db=session,
                    user_id=1,
                    recent_messages=[{"role": "user", "content": "record"}],
                )
            incident = await get_latest_incident(session, 1)
            self.assertEqual(result["agent"], "evidence_agent")
            self.assertIn("without additional details", incident.description)

    def test_messaging_response_contract_fields(self) -> None:
        response = MessagingResponse(
            status="success",
            received=True,
            is_json=True,
            response="reply",
            agent="general_agent",
            risk_level="low",
        )
        self.assertEqual(
            set(response.model_dump(exclude_none=True).keys()),
            {"status", "received", "is_json", "response", "agent", "risk_level"},
        )


if __name__ == "__main__":
    unittest.main()
