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
    def __init__(self) -> None:
        self.inventory_called = False
        self.sales_called = False

    async def get_inventory_status(self, tenant_id, branch_id=None, days_lookback=None):  # type: ignore[no-untyped-def]
        self.inventory_called = True
        return {"criticalCount": 2, "items": []}

    async def get_dashboard_summary(self, tenant_id, period_start, period_end, branch_id=None):  # type: ignore[no-untyped-def]
        self.sales_called = True
        return {"totalIncome": 1000, "completedOrders": 4, "avgTicket": 250}


def _agent(llm: Any, client: Any) -> AdminAgent:
    return AdminAgent(llm=llm, client=client)


async def test_general_intent_skips_tools() -> None:
    client = FakeClient()
    agent = _agent(FakeLLM(classify="GENERAL", reply="¡Hola! Soy tu asistente."), client)
    out = await agent.answer("hola", "t1", "+57300", "sess-1")
    assert "asistente" in out
    assert client.inventory_called is False


async def test_sales_intent_calls_dashboard_and_responds() -> None:
    client = FakeClient()
    agent = _agent(FakeLLM(classify="SALES_QUERY", reply="Vendiste $1.000"), client)
    out = await agent.answer("cuánto vendí?", "t1", "+57300", "sess-2")
    assert client.sales_called is True
    assert out == "Vendiste $1.000"


async def test_inventory_intent_calls_inventory() -> None:
    client = FakeClient()
    agent = _agent(FakeLLM(classify="INVENTORY_QUERY", reply="2 repuestos críticos"), client)
    out = await agent.answer("cómo está el stock?", "t1", "+57300", "sess-3")
    assert client.inventory_called is True
    assert "crítico" in out


async def test_llm_failure_routes_to_fallback() -> None:
    agent = _agent(FakeLLM(classify="GENERAL", fail=True), FakeClient())
    out = await agent.answer("hola", "t1", "+57300", "sess-4")
    assert "No pude completar" in out


async def test_tool_budget_exhausted_skips_tool() -> None:
    client = FakeClient()
    agent = _agent(FakeLLM(classify="SALES_QUERY", reply="ok"), client)
    out = await agent.answer("ventas?", "t1", "+57300", "sess-5", tool_call_count=5)
    # Budget reached → goes straight to respond, no tool call.
    assert client.sales_called is False
    assert out == "ok"
