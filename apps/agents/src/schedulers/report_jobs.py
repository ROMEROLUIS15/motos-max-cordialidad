"""Weekly and monthly report jobs run by the scheduler.

Each job iterates active tenants and generates the previous period's report.
A failure on one tenant is logged and skipped — the rest still run.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Any, Protocol
from zoneinfo import ZoneInfo

from ..saas_client import SaasClient

logger = logging.getLogger(__name__)

BOGOTA = ZoneInfo("America/Bogota")


class _Generator(Protocol):
    async def generate_weekly(self, tenant_id: str, start: str, end: str) -> dict[str, Any]: ...
    async def generate_monthly(self, tenant_id: str, start: str, end: str) -> dict[str, Any]: ...


GeneratorFactory = Callable[[str], _Generator]


def previous_week_period(now: datetime | None = None) -> tuple[str, str]:
    today = (now or datetime.now(BOGOTA)).date()
    this_monday = today - timedelta(days=today.weekday())
    last_monday = this_monday - timedelta(days=7)
    last_sunday = last_monday + timedelta(days=6)
    return last_monday.isoformat(), last_sunday.isoformat()


def previous_month_period(now: datetime | None = None) -> tuple[str, str]:
    today = (now or datetime.now(BOGOTA)).date()
    first_this_month = today.replace(day=1)
    last_month_end = first_this_month - timedelta(days=1)
    last_month_start = last_month_end.replace(day=1)
    return last_month_start.isoformat(), last_month_end.isoformat()


class _PeriodReportJob:
    """Shared driver for weekly/monthly jobs."""

    kind = "weekly"

    def __init__(self, client: SaasClient, make_generator: GeneratorFactory) -> None:
        self._client = client
        self._make = make_generator

    def _period(self) -> tuple[str, str]:
        raise NotImplementedError

    async def _generate(self, gen: _Generator, tenant_id: str, start: str, end: str) -> None:
        raise NotImplementedError

    async def run_once(self) -> dict[str, int]:
        start, end = self._period()
        tenants = await self._client.get_active_tenants()
        ok = failed = 0
        for tenant in tenants:
            try:
                gen = self._make(tenant.get("name", "Taller"))
                await self._generate(gen, tenant["id"], start, end)
                ok += 1
            except Exception as exc:  # noqa: BLE001 - isolate per-tenant failures
                logger.warning(
                    "%s report failed for tenant %s: %s", self.kind, tenant.get("id"), exc
                )
                failed += 1
        logger.info("%s reports: ok=%d failed=%d", self.kind, ok, failed)
        return {"ok": ok, "failed": failed, "tenants": len(tenants)}


class WeeklyReportJob(_PeriodReportJob):
    kind = "weekly"

    def _period(self) -> tuple[str, str]:
        return previous_week_period()

    async def _generate(self, gen: _Generator, tenant_id: str, start: str, end: str) -> None:
        await gen.generate_weekly(tenant_id, start, end)


class MonthlyReportJob(_PeriodReportJob):
    kind = "monthly"

    def _period(self) -> tuple[str, str]:
        return previous_month_period()

    async def _generate(self, gen: _Generator, tenant_id: str, start: str, end: str) -> None:
        await gen.generate_monthly(tenant_id, start, end)
