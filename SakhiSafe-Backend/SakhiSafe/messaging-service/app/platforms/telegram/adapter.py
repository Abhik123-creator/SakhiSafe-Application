from typing import List
from fastapi import Request
from app.models.message import NormalisedMessage
from app.platforms.base import BaseAdapter

class TelegramAdapter(BaseAdapter):
    """
    Adapter placeholder for Telegram Messenger integration.
    Currently raises NotImplementedError as specified in the forwarder architecture plan.
    """

    async def verify_webhook(self, request: Request) -> bool:
        """
        Stub verification method.
        """
        raise NotImplementedError("Telegram adapter verification is not yet implemented.")

    async def parse(self, payload: dict) -> List[NormalisedMessage]:
        """
        Stub parsing method.
        """
        raise NotImplementedError("Telegram adapter parsing is not yet implemented.")
