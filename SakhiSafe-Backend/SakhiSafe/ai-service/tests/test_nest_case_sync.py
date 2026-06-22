import unittest
from unittest.mock import AsyncMock, patch

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db.models import Base
from app.services import backend_sync_service
from app.services.message_flow_service import is_incident_log_request, process_care_seeker_message
from app.services.conversation_service import get_or_create_user
from app.tools.evidence_tools import create_incident


class NestCaseSyncTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        self.sessionmaker = async_sessionmaker(self.engine, expire_on_commit=False)

    async def asyncTearDown(self) -> None:
        await self.engine.dispose()

    async def test_low_severity_logged_incident_syncs_case(self) -> None:
        async with self.sessionmaker() as session:
            user = await get_or_create_user(session, phone="+919999999999", display_name=None)
            fake_client = type(
                "FakeClient",
                (),
                {
                    "enabled": True,
                    "get_care_seeker_by_phone": AsyncMock(return_value={"id": "care-existing"}),
                    "create_care_seeker": AsyncMock(return_value={"id": "care-new"}),
                    "update_care_seeker": AsyncMock(return_value={"id": "care-existing"}),
                    "create_case": AsyncMock(return_value={"id": "case-low"}),
                    "update_case_risk": AsyncMock(),
                },
            )()

            with patch.object(backend_sync_service, "nest_internal_client", fake_client):
                incident_id = await create_incident(
                    session,
                    user_id=user.id,
                    incident_type="other",
                    severity="low",
                    description="log my incident",
                )

            self.assertIsNotNone(incident_id)
            fake_client.get_care_seeker_by_phone.assert_awaited_once_with("+919999999999")
            fake_client.create_care_seeker.assert_not_awaited()
            care_seeker_payload = fake_client.update_care_seeker.await_args.args[1]
            self.assertEqual(care_seeker_payload["fullName"], "+919999999999")
            self.assertEqual(care_seeker_payload["phone"], "+919999999999")
            fake_client.create_case.assert_awaited_once()
            case_payload = fake_client.create_case.await_args.args[0]
            self.assertEqual(case_payload["careSeekerId"], "care-existing")
            self.assertEqual(case_payload["title"], "WhatsApp incident report")
            self.assertEqual(case_payload["summary"], "log my incident")

    async def test_message_flow_logs_explicit_incident_even_when_low_risk(self) -> None:
        fake_client = type(
            "FakeClient",
            (),
            {
                "get_care_seeker_by_phone": AsyncMock(return_value={"id": "care-existing"}),
                "create_care_seeker": AsyncMock(return_value={"id": "care-new"}),
                "update_care_seeker": AsyncMock(return_value={"id": "care-existing"}),
                "create_case": AsyncMock(return_value={"id": "case-low"}),
            },
        )()

        with patch("app.services.message_flow_service.nest_internal_client", fake_client):
            result = await process_care_seeker_message(
                {
                    "phoneNumber": "+919999999999",
                    "message": "log my incident",
                    "name": None,
                    "metadata": {"namePrompted": True},
                }
            )

        self.assertTrue(is_incident_log_request("log my incident"))
        self.assertEqual(result["riskLevel"], "LOW")
        self.assertTrue(result["caseSynced"])
        fake_client.get_care_seeker_by_phone.assert_awaited_once_with("+919999999999")
        fake_client.create_care_seeker.assert_not_awaited()
        fake_client.create_case.assert_awaited_once()
        case_payload = fake_client.create_case.await_args.args[0]
        self.assertEqual(case_payload["careSeekerId"], "care-existing")
        self.assertEqual(case_payload["title"], "WhatsApp incident report")
        self.assertEqual(case_payload["summary"], "log my incident")


if __name__ == "__main__":
    unittest.main()
