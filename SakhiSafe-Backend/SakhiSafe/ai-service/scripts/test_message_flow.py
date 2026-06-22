import asyncio
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.services.message_flow_service import process_care_seeker_message


async def main() -> None:
    result = await process_care_seeker_message(
        {
            "phoneNumber": "+919999999999",
            "message": "He threatened me yesterday",
            "name": None,
            "metadata": {},
        }
    )
    print(f"displayName = {result['displayName']}")
    print(f"riskLevel = {result['riskLevel']}")
    print(f"matchedSignals = {result['matchedSignals']}")
    print(f"careSeekerId = {result.get('careSeekerId')}")
    print(f"caseId = {result.get('caseId')}")
    print(f"caseDraft = {result['caseDraft']}")
    print(f"final response = {result['finalResponse']}")


if __name__ == "__main__":
    asyncio.run(main())
