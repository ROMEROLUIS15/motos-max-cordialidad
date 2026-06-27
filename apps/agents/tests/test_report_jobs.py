from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from src.schedulers.report_jobs import (
    MonthlyReportJob,
    WeeklyReportJob,
    previous_month_period,
    previous_week_period,
)

BOGOTA = ZoneInfo("America/Bogota")


def test_previous_week_period_is_prior_monday_to_sunday() -> None:
    # Wednesday 2026-06-24 → previous week Mon 2026-06-15 .. Sun 2026-06-21
    now = datetime(2026, 6, 24, 10, 0, tzinfo=BOGOTA)
    start, end = previous_week_period(now)
    assert start == "2026-06-15"
    assert end == "2026-06-21"


def test_previous_month_period() -> None:
    now = datetime(2026, 6, 10, tzinfo=BOGOTA)
    start, end = previous_month_period(now)
    assert start == "2026-05-01"
    assert end == "2026-05-31"


class FakeGen:
    def __init__(self) -> None:
        self.weekly: list[str] = []
        self.monthly: list[str] = []

    async def generate_weekly(self, tenant_id, start, end):  # type: ignore[no-untyped-def]
        self.weekly.append(tenant_id)
        return {"reportId": "r"}

    async def generate_monthly(self, tenant_id, start, end):  # type: ignore[no-untyped-def]
        self.monthly.append(tenant_id)
        return {"reportId": "r"}


class FakeClient:
    def __init__(self, fail_for: set[str] | None = None) -> None:
        self._fail = fail_for or set()

    async def get_active_tenants(self) -> list[dict[str, Any]]:
        return [{"id": "t1", "name": "A"}, {"id": "t2", "name": "B"}]


async def test_weekly_job_generates_for_each_tenant() -> None:
    gen = FakeGen()
    job = WeeklyReportJob(FakeClient(), lambda name: gen)  # type: ignore[arg-type]
    stats = await job.run_once()
    assert stats == {"ok": 2, "failed": 0, "tenants": 2}
    assert gen.weekly == ["t1", "t2"]


async def test_monthly_job_isolates_failures() -> None:
    class Boom:
        async def generate_monthly(self, tenant_id, start, end):  # type: ignore[no-untyped-def]
            raise RuntimeError("nope")

        async def generate_weekly(self, tenant_id, start, end):  # type: ignore[no-untyped-def]
            return {}

    job = MonthlyReportJob(FakeClient(), lambda name: Boom())  # type: ignore[arg-type]
    stats = await job.run_once()
    assert stats["failed"] == 2
    assert stats["ok"] == 0
