from typing import Any

from src.schedulers.stock_alert import StockAlertJob, throttle_key


class FakeRedis:
    def __init__(self) -> None:
        self.store: dict[str, str] = {}

    async def get(self, key: str) -> str | None:
        return self.store.get(key)

    async def set(self, key: str, value: str, ex: int | None = None) -> None:
        self.store[key] = value


class FakeClient:
    def __init__(self, fail_tenants: set[str] | None = None) -> None:
        self.alerts: list[tuple[str, str]] = []
        self._fail = fail_tenants or set()

    async def get_active_tenants(self) -> list[dict[str, Any]]:
        return [{"id": "t1"}, {"id": "t2"}]

    async def get_inventory_status(self, tenant_id, branch_id=None, days_lookback=None):  # type: ignore[no-untyped-def]
        if tenant_id in self._fail:
            raise RuntimeError("inventory down")
        return {
            "items": [{"partId": "p1", "name": "Filtro", "stockDisponible": 2, "minStockAlert": 5}]
        }

    async def send_stock_alert(self, tenant_id, part_id, part_name, current_stock, min_stock):  # type: ignore[no-untyped-def]
        self.alerts.append((tenant_id, part_id))
        return {"notified": 1}


def test_throttle_key_format() -> None:
    assert throttle_key("t1", "p1") == "alert:stock:t1:p1"


async def test_sends_alerts_for_low_stock() -> None:
    client = FakeClient()
    job = StockAlertJob(client, FakeRedis())  # type: ignore[arg-type]
    stats = await job.run_once()
    assert stats["sent"] == 2  # one part each for t1 and t2
    assert ("t1", "p1") in client.alerts


async def test_throttle_prevents_repeat_within_window() -> None:
    client = FakeClient()
    redis = FakeRedis()
    job = StockAlertJob(client, redis)  # type: ignore[arg-type]

    first = await job.run_once()
    second = await job.run_once()

    assert first["sent"] == 2
    assert second["sent"] == 0
    assert second["skipped"] == 2


async def test_one_tenant_failure_does_not_stop_others() -> None:
    client = FakeClient(fail_tenants={"t1"})
    job = StockAlertJob(client, FakeRedis())  # type: ignore[arg-type]
    stats = await job.run_once()
    assert stats["failed"] == 1
    assert stats["sent"] == 1  # t2 still processed
