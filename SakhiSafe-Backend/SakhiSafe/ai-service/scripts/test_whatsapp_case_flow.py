import asyncio
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.services.whatsapp_case_service import process_whatsapp_case_flow


async def main() -> None:
    result = await process_whatsapp_case_flow(
        phone_number="+919999999999",
        message="He threatened me yesterday",
        name=None,
        create_low_medium_cases=True,
    )

    print(f"success = {result['success']}")
    print(f"normalizedPhone = {result['phoneNumber']}")
    print(f"careSeekerId = {result.get('careSeekerId')}")
    print(f"caseId = {result.get('caseId')}")
    print(f"caseAction = {result.get('caseAction')}")
    print(f"riskLevel = {result['riskLevel']}")
    print(f"matchedSignals = {result['matchedSignals']}")
    print(f"caseDraft = {result['caseDraft']}")
    if not result["success"]:
        print(f"error = {result.get('error')}")


if __name__ == "__main__":
    asyncio.run(main())
