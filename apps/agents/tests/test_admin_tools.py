import pytest
from pydantic import ValidationError

from src.agents.admin import memory as memory_mod
from src.tools.admin_tools import (
    InventoryStatusInput,
    PurchaseOrderInput,
    ReportInput,
    trigger_report_generation,
)


class FakeClient:
    async def generate_report(self, tenant_id, report_type, period_start, period_end):  # type: ignore[no-untyped-def]
        return {"id": "rep-1", "status": "PENDING"}


def test_inventory_input_clamps_lookback_range() -> None:
    assert InventoryStatusInput(tenant_id="t1").days_lookback == 30
    with pytest.raises(ValidationError):
        InventoryStatusInput(tenant_id="t1", days_lookback=0)


def test_purchase_order_requires_items() -> None:
    with pytest.raises(ValidationError):
        PurchaseOrderInput(tenant_id="t1", items=[])


async def test_trigger_report_returns_friendly_message() -> None:
    out = await trigger_report_generation(
        FakeClient(),
        ReportInput(tenant_id="t1", period_start="2026-06-01", period_end="2026-06-07"),
    )
    assert out["reportId"] == "rep-1"
    assert "plataforma" in out["message"]


class FakeRedis:
    def __init__(self) -> None:
        self.store: dict[str, str] = {}

    async def get(self, key: str) -> str | None:
        return self.store.get(key)

    async def set(self, key: str, value: str, ex: int | None = None) -> None:
        self.store[key] = value


async def test_session_store_records_and_loads_turns() -> None:
    store = memory_mod.AdminSessionStore(FakeRedis(), ttl_seconds=7200)
    await store.record_turn("t1", "+57300", "hola", "qué tal")
    data = await store.load("t1", "+57300")
    assert data["history"][-2:] == [
        {"role": "user", "content": "hola"},
        {"role": "assistant", "content": "qué tal"},
    ]
    assert memory_mod.session_key("t1", "+57300") == "agent:admin:t1:+57300"
