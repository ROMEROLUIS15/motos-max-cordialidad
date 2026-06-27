"""HTTP client for the NestJS SaaS API (Fase 2A ``/api/agents`` endpoints).

Authenticates with short-lived service tokens (``type:"service"``) minted with
the shared ``JWT_SECRET`` — mirrors the NestJS ``TokenFactoryService``. The
``tenantId`` travels explicitly per request; it is never embedded in the token.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, cast

import httpx
import jwt

from .config import Settings, get_settings

logger = logging.getLogger(__name__)

_RETRY_ATTEMPTS = 2
_RETRY_BACKOFF_SECONDS = 0.5


class SaasClient:
    def __init__(self, settings: Settings | None = None, client: httpx.AsyncClient | None = None):
        self._settings = settings or get_settings()
        self._client = client or httpx.AsyncClient(
            base_url=self._settings.API_BASE_URL,
            timeout=httpx.Timeout(15.0),
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    # --- auth -------------------------------------------------------------
    def _service_token(self) -> str:
        now = int(time.time())
        payload = {
            "sub": "agents-service",
            "type": "service",
            "iat": now,
            "exp": now + self._settings.SERVICE_TOKEN_TTL_SECONDS,
        }
        return jwt.encode(payload, self._settings.JWT_SECRET, algorithm="HS256")

    def _auth_headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._service_token()}"}

    # --- low-level request with retry ------------------------------------
    async def _request(
        self,
        method: str,
        url: str,
        *,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
        auth: bool = True,
    ) -> httpx.Response:
        last_exc: Exception | None = None
        for attempt in range(_RETRY_ATTEMPTS + 1):
            try:
                resp = await self._client.request(
                    method,
                    url,
                    params=params,
                    json=json,
                    headers=self._auth_headers() if auth else None,
                )
                resp.raise_for_status()
                return resp
            except (httpx.TransportError, httpx.HTTPStatusError) as exc:
                # Don't retry 4xx (client errors are deterministic).
                if isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code < 500:
                    raise
                last_exc = exc
                if attempt < _RETRY_ATTEMPTS:
                    await asyncio.sleep(_RETRY_BACKOFF_SECONDS * (attempt + 1))
        assert last_exc is not None
        logger.warning("Request %s %s failed after retries: %s", method, url, last_exc)
        raise last_exc

    # --- health ----------------------------------------------------------
    async def api_health(self) -> bool:
        try:
            resp = await self._client.get("/api/health")
            return resp.status_code == 200
        except httpx.HTTPError:
            return False

    # --- agents endpoints ------------------------------------------------
    async def get_active_tenants(self) -> list[dict[str, Any]]:
        resp = await self._request("GET", "/api/agents/tenants")
        return cast(list[dict[str, Any]], resp.json())

    async def get_dashboard_summary(
        self,
        tenant_id: str,
        period_start: str,
        period_end: str,
        branch_id: str | None = None,
    ) -> dict[str, Any]:
        params: dict[str, Any] = {
            "tenantId": tenant_id,
            "periodStart": period_start,
            "periodEnd": period_end,
        }
        if branch_id:
            params["branchId"] = branch_id
        resp = await self._request("GET", "/api/agents/dashboard/summary", params=params)
        return cast(dict[str, Any], resp.json())

    async def get_inventory_status(
        self,
        tenant_id: str,
        branch_id: str | None = None,
        days_lookback: int | None = None,
    ) -> dict[str, Any]:
        params: dict[str, Any] = {"tenantId": tenant_id}
        if branch_id:
            params["branchId"] = branch_id
        if days_lookback is not None:
            params["daysLookback"] = days_lookback
        resp = await self._request("GET", "/api/agents/inventory/status", params=params)
        return cast(dict[str, Any], resp.json())

    async def get_pending_work_orders(
        self, tenant_id: str, branch_id: str | None = None
    ) -> list[dict[str, Any]]:
        params: dict[str, Any] = {"tenantId": tenant_id}
        if branch_id:
            params["branchId"] = branch_id
        resp = await self._request("GET", "/api/agents/work-orders/pending", params=params)
        return cast(list[dict[str, Any]], resp.json())

    async def create_purchase_order_draft(
        self, tenant_id: str, items: list[dict[str, Any]], notes: str | None = None
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"tenantId": tenant_id, "items": items}
        if notes:
            body["notes"] = notes
        resp = await self._request("POST", "/api/agents/purchase-orders/draft", json=body)
        return cast(dict[str, Any], resp.json())

    async def send_stock_alert(
        self,
        tenant_id: str,
        part_id: str,
        part_name: str,
        current_stock: float,
        min_stock: float,
    ) -> dict[str, Any]:
        body = {
            "tenantId": tenant_id,
            "partId": part_id,
            "partName": part_name,
            "currentStock": current_stock,
            "minStock": min_stock,
        }
        resp = await self._request("POST", "/api/agents/notifications/stock-alert", json=body)
        return cast(dict[str, Any], resp.json())

    async def send_owner_whatsapp(self, tenant_id: str, content: str) -> dict[str, Any]:
        body = {"tenantId": tenant_id, "content": content}
        resp = await self._request("POST", "/api/agents/notifications/whatsapp", json=body)
        return cast(dict[str, Any], resp.json())

    async def record_report(
        self,
        tenant_id: str,
        report_type: str,
        period_start: str,
        period_end: str,
        pdf_r2_key: str,
    ) -> dict[str, Any]:
        body = {
            "tenantId": tenant_id,
            "type": report_type,
            "periodStart": period_start,
            "periodEnd": period_end,
            "pdfR2Key": pdf_r2_key,
        }
        resp = await self._request("POST", "/api/agents/reports", json=body)
        return cast(dict[str, Any], resp.json())

    async def generate_report(
        self, tenant_id: str, report_type: str, period_start: str, period_end: str
    ) -> dict[str, Any]:
        body = {
            "tenantId": tenant_id,
            "type": report_type,
            "periodStart": period_start,
            "periodEnd": period_end,
        }
        resp = await self._request("POST", "/api/agents/reports/generate", json=body)
        return cast(dict[str, Any], resp.json())
