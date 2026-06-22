from abc import ABC, abstractmethod
from typing import List
from fastapi import Request
from app.models.message import NormalisedMessage

class BaseAdapter(ABC):
    """
    Abstract Base Class for all messaging platform adapters.
    Ensures consistent API contracts for webhook validation and parsing.
    """

    @abstractmethod
    async def verify_webhook(self, request: Request) -> bool:
        """
        Validate the inbound webhook request.
        GET request verify tokens or POST signature hash headers depending on the provider.
        """
        pass

    @abstractmethod
    async def parse(self, payload: dict) -> List[NormalisedMessage]:
        """
        Deconstruct raw platform-specific webhook dictionaries,
        filtering out invalid entries and normalizing them into standard NormalisedMessage schemas.
        """
        pass
