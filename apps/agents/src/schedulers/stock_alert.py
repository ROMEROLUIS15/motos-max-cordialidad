"""Hourly stock-alert job with a 24h per-part throttle in Redis.

Lists active tenants, checks each for low stock, and pushes an alert via the
NestJS ``/api/agents/notifications/stock-alert`` endpoint — but at most once per
part every 24 hours (key ``alert:stock:{tenant}:{part}``). A failure on one
tenant never stops the others.
"""

from __future__ import annotations

import logging
from typing import Any, Protocol

from ..saas_client import SaasClient

logger = logging.getLogger(__name__)

THROTTLE_TTL_SECONDS = 24 * 60 * 60


class _Redis(Protocol):
    async def get(self, key: str) -> str | None: ...
    async def set(self, key: str, value: str, ex: int | None = ...) -> Any: ...


def throttle_key(tenant_id: str, part_id: str) -> str:
    return f"alert:stock:{tenant_id}:{part_id}"


class StockAlertJob:
    def __init__(self, client: SaasClient, redis: _Redis) -> None:
        self._client = client
        self._redis = redis

    async def _is_throttled(self, tenant_id: str, part_id: str) -> bool:
        return await self._redis.get(throttle_key(tenant_id, part_id)) is not None

    async def _mark_sent(self, tenant_id: str, part_id: str) -> None:
        await self._redis.set(throttle_key(tenant_id, part_id), "1", ex=THROTTLE_TTL_SECONDS)

    async def run_once(self) -> dict[str, int]:
        tenants = await self._client.get_active_tenants()
        sent = skipped = failed = 0
        for tenant in tenants:
            tenant_id = tenant["id"]
            try:
                inventory = await self._client.get_inventory_status(tenant_id)
            except Exception as exc:  # noqa: BLE001 - isolate per-tenant failures
                logger.warning("stock-alert: tenant %s inventory failed: %s", tenant_id, exc)
                failed += 1
                continue
            for item in inventory.get("items", []):
                part_id = item["partId"]
                if await self._is_throttled(tenant_id, part_id):
                    skipped += 1
                    continue
                try:
                    await self._client.send_stock_alert(
                        tenant_id,
                        part_id,
                        item.get("name", ""),
                        float(item.get("stockDisponible", 0)),
                        float(item.get("minStockAlert", 0)),
                    )
                    await self._mark_sent(tenant_id, part_id)
                    sent += 1
                except Exception as exc:  # noqa: BLE001
                    logger.warning(
                        "stock-alert: send failed tenant=%s part=%s: %s", tenant_id, part_id, exc
                    )
                    failed += 1
        logger.info("stock-alert pass: sent=%d skipped=%d failed=%d", sent, skipped, failed)
        return {"sent": sent, "skipped": skipped, "failed": failed, "tenants": len(tenants)}


def register_hourly(scheduler: Any, job: StockAlertJob) -> None:
    """Attach the job to an APScheduler instance (hourly)."""
    scheduler.add_job(job.run_once, "interval", hours=1, id="stock_alert", replace_existing=True)
