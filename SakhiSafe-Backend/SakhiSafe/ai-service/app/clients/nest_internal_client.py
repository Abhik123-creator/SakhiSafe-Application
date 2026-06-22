import logging
import time
from typing import Any
from urllib.parse import quote

import httpx

from app.config import settings


logger = logging.getLogger("sakhi-ai-service.nest_internal_client")


class NestInternalClientError(RuntimeError):
    pass


class NestInternalNotFoundError(NestInternalClientError):
    pass


class NestInternalClient:
    def __init__(
        self,
        base_url: str,
        client_id: str,
        client_secret: str,
        refresh_buffer_seconds: int = 60,
        timeout_seconds: float = 5.0,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.client_id = client_id
        self.client_secret = client_secret
        self.refresh_buffer_seconds = refresh_buffer_seconds
        self.timeout_seconds = timeout_seconds
        self._access_token: str | None = None
        self._expires_at = 0.0
        self._last_expires_in: int | None = None

    @property
    def enabled(self) -> bool:
        return bool(self.base_url and self.client_id and self.client_secret)

    @property
    def last_expires_in(self) -> int | None:
        return self._last_expires_in

    async def get_service_token(self, force_refresh: bool = False) -> str:
        if not force_refresh and self._access_token and not self._token_needs_refresh():
            return self._access_token

        if not self.enabled:
            raise NestInternalClientError("Nest internal client is not configured.")

        try:
            async with httpx.AsyncClient(base_url=self.base_url, timeout=self.timeout_seconds) as client:
                response = await client.post(
                    "/internal/v1/auth/token",
                    json={"clientId": self.client_id, "clientSecret": self.client_secret},
                )
        except httpx.HTTPError as exc:
            raise NestInternalClientError(f"Nest token request failed: {exc}") from exc

        if response.status_code >= 400:
            raise NestInternalClientError(f"Nest token request returned {response.status_code}.")

        payload = response.json()
        access_token = payload.get("accessToken")
        expires_in = int(payload.get("expiresIn", 900))
        if not access_token:
            raise NestInternalClientError("Nest token response did not include accessToken.")

        self._access_token = str(access_token)
        self._last_expires_in = expires_in
        self._expires_at = time.time() + expires_in
        logger.info("Nest service token received expires_in=%s", expires_in)
        return self._access_token

    async def request(
        self,
        method: str,
        path: str,
        json: dict[str, Any] | None = None,
        params: dict[str, Any] | None = None,
        retry_on_unauthorized: bool = True,
    ) -> Any:
        if not path.startswith("/internal/v1/"):
            raise NestInternalClientError("NestInternalClient only calls /internal/v1/* endpoints.")

        token = await self.get_service_token()
        headers = {"Authorization": f"Bearer {token}"}

        try:
            async with httpx.AsyncClient(base_url=self.base_url, timeout=self.timeout_seconds) as client:
                response = await client.request(method, path, json=json, params=params, headers=headers)
        except httpx.HTTPError as exc:
            raise NestInternalClientError(f"Nest internal request failed: {exc}") from exc

        logger.info("Nest internal request method=%s path=%s status=%s", method, path, response.status_code)

        if response.status_code == 401 and retry_on_unauthorized:
            await self.get_service_token(force_refresh=True)
            return await self.request(method, path, json=json, params=params, retry_on_unauthorized=False)

        if response.status_code == 404:
            raise NestInternalNotFoundError(f"Nest internal request returned 404 for {method} {path}.")

        if response.status_code >= 400:
            raise NestInternalClientError(f"Nest internal request returned {response.status_code}: {response.text[:200]}")

        if not response.content:
            return {}
        return response.json()

    async def multipart_request(
        self,
        path: str,
        data: dict[str, Any],
        files: dict[str, Any],
        retry_on_unauthorized: bool = True,
    ) -> Any:
        if not path.startswith("/internal/v1/"):
            raise NestInternalClientError("NestInternalClient only calls /internal/v1/* endpoints.")

        token = await self.get_service_token()
        headers = {"Authorization": f"Bearer {token}"}

        try:
            async with httpx.AsyncClient(base_url=self.base_url, timeout=max(self.timeout_seconds, 30.0)) as client:
                response = await client.post(path, data=data, files=files, headers=headers)
        except httpx.HTTPError as exc:
            raise NestInternalClientError(f"Nest multipart request failed: {exc}") from exc

        logger.info("Nest multipart request path=%s status=%s", path, response.status_code)

        if response.status_code == 401 and retry_on_unauthorized:
            await self.get_service_token(force_refresh=True)
            return await self.multipart_request(path, data=data, files=files, retry_on_unauthorized=False)

        if response.status_code == 404:
            raise NestInternalNotFoundError(f"Nest multipart request returned 404 for {path}.")

        if response.status_code >= 400:
            raise NestInternalClientError(f"Nest multipart request returned {response.status_code}: {response.text[:200]}")

        if not response.content:
            return {}
        return response.json()

    async def get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        return await self.request("GET", path, params=params)

    async def post(self, path: str, json: dict[str, Any] | None = None) -> Any:
        return await self.request("POST", path, json=json)

    async def patch(self, path: str, json: dict[str, Any] | None = None) -> Any:
        return await self.request("PATCH", path, json=json)

    async def put(self, path: str, json: dict[str, Any] | None = None) -> Any:
        return await self.request("PUT", path, json=json)

    async def create_care_seeker(self, payload: dict[str, Any]) -> Any:
        return await self.post("/internal/v1/care-seekers", json=payload)

    async def get_care_seeker_by_phone(self, phone: str) -> Any | None:
        try:
            return await self.get(f"/internal/v1/care-seekers/by-phone/{quote(phone, safe='')}")
        except NestInternalNotFoundError:
            return None

    async def update_care_seeker(self, care_seeker_id: str, payload: dict[str, Any]) -> Any:
        return await self.patch(f"/internal/v1/care-seekers/{care_seeker_id}", json=payload)

    async def create_case(self, payload: dict[str, Any]) -> Any:
        return await self.post("/internal/v1/cases", json=payload)

    async def list_cases_by_phone(self, phone: str) -> Any:
        try:
            return await self.get(f"/internal/v1/cases/by-phone/{quote(phone, safe='')}")
        except NestInternalNotFoundError:
            return []

    async def get_incident_missing_fields_by_phone(self, phone: str) -> Any | None:
        try:
            return await self.get(f"/internal/v1/incidents/missing-fields/by-phone/{quote(phone, safe='')}")
        except NestInternalNotFoundError:
            return None

    async def get_active_incident_by_phone(self, phone: str) -> Any | None:
        try:
            return await self.get(f"/internal/v1/incidents/active-by-phone/{quote(phone, safe='')}")
        except NestInternalNotFoundError:
            return None

    async def update_case(self, case_id: str, payload: dict[str, Any]) -> Any:
        return await self.patch(f"/internal/v1/cases/{case_id}", json=payload)

    async def update_case_risk(self, case_id: str, payload: dict[str, Any]) -> Any:
        return await self.update_case(case_id, payload)

    async def get_or_create_care_seeker(self, payload: dict[str, Any]) -> Any:
        return await self.post("/internal/v1/care-seekers/get-or-create", json=payload)

    async def get_or_create_active_session(self, payload: dict[str, Any]) -> Any:
        return await self.post("/internal/v1/conversation-sessions/get-or-create-active", json=payload)

    async def create_conversation_message(self, payload: dict[str, Any]) -> Any:
        return await self.post("/internal/v1/conversation-messages", json=payload)

    async def ai_upsert_incident(self, payload: dict[str, Any]) -> Any:
        return await self.post("/internal/v1/incidents/ai-upsert", json=payload)

    async def ensure_draft_incident_for_session(self, payload: dict[str, Any]) -> Any:
        return await self.post("/internal/v1/incidents/ensure-draft-for-session", json=payload)

    async def upload_image_evidence(
        self,
        data: dict[str, Any],
        file_name: str,
        image_bytes: bytes,
        mime_type: str,
    ) -> Any:
        files = {"file": (file_name, image_bytes, mime_type)}
        return await self.multipart_request("/internal/v1/evidence/upload-image", data=data, files=files)

    async def upload_image_analysis_media_observation(
        self,
        data: dict[str, Any],
        file_name: str,
        image_bytes: bytes,
        mime_type: str,
    ) -> Any:
        files = {"file": (file_name, image_bytes, mime_type)}
        return await self.multipart_request("/internal/v1/case-notes/image-analysis", data=data, files=files)

    async def upload_image_analysis_case_note(
        self,
        data: dict[str, Any],
        file_name: str,
        image_bytes: bytes,
        mime_type: str,
    ) -> Any:
        return await self.upload_image_analysis_media_observation(data, file_name, image_bytes, mime_type)

    async def create_or_update_conversation(self, payload: dict[str, Any]) -> Any:
        # TODO: Enable when the NestJS backend exposes this internal endpoint.
        raise NestInternalClientError("Nest internal conversation endpoint is not available yet.")

    async def create_message(self, payload: dict[str, Any]) -> Any:
        # TODO: Enable when the NestJS backend exposes this internal endpoint.
        raise NestInternalClientError("Nest internal message endpoint is not available yet.")

    async def create_incident(self, payload: dict[str, Any]) -> Any:
        # TODO: Enable when the NestJS backend exposes this internal endpoint.
        raise NestInternalClientError("Nest internal incident endpoint is not available yet.")

    async def get_resources(self, params: dict[str, Any] | None = None) -> Any:
        # TODO: Enable when the NestJS backend exposes this internal endpoint.
        raise NestInternalClientError("Nest internal resources endpoint is not available yet.")

    def _token_needs_refresh(self) -> bool:
        return time.time() >= self._expires_at - self.refresh_buffer_seconds


nest_internal_client = NestInternalClient(
    base_url=settings.nest_internal_base_url,
    client_id=settings.internal_service_client_id,
    client_secret=settings.internal_service_client_secret,
    refresh_buffer_seconds=settings.service_token_refresh_buffer_seconds,
    timeout_seconds=settings.nest_internal_timeout_seconds,
)
