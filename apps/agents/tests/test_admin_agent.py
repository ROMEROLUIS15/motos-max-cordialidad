from typing import Any

from src.agents.admin.agent import AdminAgent


class FakeLLM:
    """Returns scripted replies; ``complete`` is called for classify + respond."""

    def __init__(self, classify: str, reply: str = "respuesta final", fail: bool = False) -> None:
        self._classify = classify
        self._reply = reply
        self._fail = fail
        self.calls = 0

    async def complete(self, messages: Any, temperature: float = 0.3) -> str:
        self.calls += 1
        if self._fail:
            raise RuntimeError("llm down")
        # First call is classification (temperature 0.0), rest are responses.
        return self._classify if self.calls == 1 else self._reply


class FakeClient:
    def __init__(self, inventory_items: list[dict[str, Any]] | None = None) -> None:
        self.inventory_called = False
        self.sales_called = False
        self.draft_called = False
        self.draft_items: list[dict[str, Any]] | None = None
        self._inventory_items = inventory_items or []

    async def get_inventory_status(self, tenant_id, branch_id=None, days_lookback=None):  # type: ignore[no-untyped-def]
        self.inventory_called = True
        return {"criticalCount": 2, "items": self._inventory_items}

    async def get_dashboard_summary(self, tenant_id, period_start, period_end, branch_id=None):  # type: ignore[no-untyped-def]
        self.sales_called = True
        return {"totalIncome": 1000, "completedOrders": 4, "avgTicket": 250}

    async def create_purchase_order_draft(self, tenant_id, items, notes=None):  # type: ignore[no-untyped-def]
        self.draft_called = True
        self.draft_items = items
        return {"id": "draft-1", "status": "DRAFT"}


def _agent(llm: Any, client: Any) -> AdminAgent:
    return AdminAgent(llm=llm, client=client)


async def test_general_intent_skips_tools() -> None:
    client = FakeClient()
    agent = _agent(FakeLLM(classify="GENERAL", reply="¡Hola! Soy tu asistente."), client)
    reply, intent, _awaiting = await agent.answer("hola", "t1", "+57300", "sess-1")
    assert "asistente" in reply
    assert client.inventory_called is False


async def test_sales_intent_calls_dashboard_and_responds() -> None:
    client = FakeClient()
    agent = _agent(FakeLLM(classify="SALES_QUERY", reply="Vendiste $1.000"), client)
    reply, intent, _awaiting = await agent.answer("cuánto vendí?", "t1", "+57300", "sess-2")
    assert client.sales_called is True
    assert reply == "Vendiste $1.000"


async def test_inventory_intent_calls_inventory() -> None:
    client = FakeClient()
    agent = _agent(FakeLLM(classify="INVENTORY_QUERY", reply="2 repuestos críticos"), client)
    reply, intent, _awaiting = await agent.answer("cómo está el stock?", "t1", "+57300", "sess-3")
    assert client.inventory_called is True
    assert "crítico" in reply


async def test_llm_failure_routes_to_fallback() -> None:
    agent = _agent(FakeLLM(classify="GENERAL", fail=True), FakeClient())
    reply, intent, _awaiting = await agent.answer("hola", "t1", "+57300", "sess-4")
    assert "No pude completar" in reply


async def test_tool_budget_exhausted_skips_tool() -> None:
    client = FakeClient()
    agent = _agent(FakeLLM(classify="SALES_QUERY", reply="ok"), client)
    reply, intent, _awaiting = await agent.answer(
        "ventas?", "t1", "+57300", "sess-5", tool_call_count=5
    )
    assert client.sales_called is False
    assert reply == "ok"


async def test_po_request_sets_awaiting_flag() -> None:
    client = FakeClient()
    agent = _agent(
        FakeLLM(classify="PURCHASE_ORDER_REQUEST", reply="Estos son los repuestos bajos"), client
    )
    reply, intent, awaiting = await agent.answer("quiero reabastecer", "t1", "+57300", "sess-6")
    assert intent == "PURCHASE_ORDER_REQUEST"
    assert awaiting is True  # next turn may honor a confirmation
    assert client.draft_called is False  # request alone never creates a draft


async def test_po_confirm_without_pending_is_ignored() -> None:
    # A bare "sí" the LLM misreads as a confirmation, but nothing was proposed.
    client = FakeClient(
        inventory_items=[{"partId": "p1", "stockDisponible": 0, "minStockAlert": 5}]
    )
    agent = _agent(FakeLLM(classify="PURCHASE_ORDER_CONFIRM", reply="¡Con gusto!"), client)
    reply, intent, awaiting = await agent.answer(
        "sí", "t1", "+57300", "sess-7", awaiting_po_confirmation=False
    )
    assert intent == "GENERAL"  # downgraded, no tool runs
    assert client.draft_called is False
    assert awaiting is False


async def test_po_confirm_with_pending_creates_draft() -> None:
    client = FakeClient(
        inventory_items=[
            {"partId": "p1", "stockDisponible": 0, "minStockAlert": 5, "suggestedReorderQty": 8}
        ]
    )
    agent = _agent(FakeLLM(classify="PURCHASE_ORDER_CONFIRM", reply="Borrador creado"), client)
    reply, intent, awaiting = await agent.answer(
        "confirmar", "t1", "+57300", "sess-8", awaiting_po_confirmation=True
    )
    assert intent == "PURCHASE_ORDER_CONFIRM"
    assert client.draft_called is True
    assert client.draft_items == [{"partId": "p1", "quantity": 8}]
    assert awaiting is False  # confirmation consumed, no longer pending
