import asyncio
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.clients.nest_internal_client import NestInternalClientError, nest_internal_client


async def main() -> None:
    try:
        token = await nest_internal_client.get_service_token()
        print(f"token received: {'yes' if token else 'no'}")
        print(f"expiresIn: {nest_internal_client.last_expires_in}")
    except NestInternalClientError as exc:
        print("token received: no")
        print(f"error: {exc}")


if __name__ == "__main__":
    asyncio.run(main())
