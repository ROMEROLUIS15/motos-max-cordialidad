from typing import Any

from src.api.admin_handler import AdminHandler


class FakeAgent:
    def __init__(self) -> None:
        self.last_count: int | None = None

    async def answer(self, message, tenant_id, admin_phone, session_id, tool_call_count=0):  # type: ignore[no-untyped-def]
        self.last_count = tool_call_count
        return f"respuesta a: {message}"


class FakeSessions:
    def __init__(self, count: int = 0) -> None:
        self._count = count
        self.recorded: tuple[str, str] | None = None

    async def load(self, tenant_id: str, phone: str) -> dict[str, Any]:
        return {"history": [], "tool_call_count": self._count}

    async def record_turn(self, tenant_id, phone, user_message, assistant_message):  # type: ignore[no-untyped-def]
        self.recorded = (user_message, assistant_message)


class FakeClient:
    def __init__(self, fail: bool = False) -> None:
        self.sent: str | None = None
        self._fail = fail

    async def send_owner_whatsapp(self, tenant_id: str, content: str) -> dict[str, Any]:
        if self._fail:
            raise RuntimeError("whatsapp down")
        self.sent = content
        return {"sent": True}


async def test_handle_runs_agent_and_sends_reply() -> None:
    agent, sessions, client = FakeAgent(), FakeSessions(count=2), FakeClient()
    handler = AdminHandler(agent, sessions, client)  # type: ignore[arg-type]

    out = await handler.handle("cuánto vendí?", "+57300", "t1")

    assert out["status"] == "ok"
    assert out["reply"] == "respuesta a: cuánto vendí?"
    assert client.sent == out["reply"]
    assert sessions.recorded == ("cuánto vendí?", out["reply"])
    assert agent.last_count == 2  # session tool_call_count is threaded in


async def test_handle_survives_send_failure() -> None:
    handler = AdminHandler(FakeAgent(), FakeSessions(), FakeClient(fail=True))  # type: ignore[arg-type]
    out = await handler.handle("hola", "+57300", "t1")
    assert out["status"] == "ok"  # reply computed even if WhatsApp send failed
