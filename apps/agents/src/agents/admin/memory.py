"""Admin conversation sessions persisted in Redis.

LangGraph uses an in-process ``MemorySaver`` for a single run; cross-message
continuity (the 2-hour admin window) lives here, keyed by tenant + phone.
"""

from __future__ import annotations

import json
from typing import Any, Protocol


class _Redis(Protocol):
    async def get(self, key: str) -> str | None: ...
    async def set(self, key: str, value: str, ex: int | None = ...) -> Any: ...


def session_key(tenant_id: str, phone: str) -> str:
    return f"agent:admin:{tenant_id}:{phone}"


class AdminSessionStore:
    def __init__(self, redis: _Redis, ttl_seconds: int) -> None:
        self._redis = redis
        self._ttl = ttl_seconds

    async def load(self, tenant_id: str, phone: str) -> dict[str, Any]:
        raw = await self._redis.get(session_key(tenant_id, phone))
        if not raw:
            return {"history": [], "tool_call_count": 0}
        data: dict[str, Any] = json.loads(raw)
        data.setdefault("history", [])
        data.setdefault("tool_call_count", 0)
        return data

    async def save(
        self, tenant_id: str, phone: str, history: list[dict[str, str]], tool_call_count: int
    ) -> None:
        payload = json.dumps({"history": history[-20:], "tool_call_count": tool_call_count})
        await self._redis.set(session_key(tenant_id, phone), payload, ex=self._ttl)

    async def record_turn(
        self, tenant_id: str, phone: str, user_message: str, assistant_message: str
    ) -> None:
        data = await self.load(tenant_id, phone)
        history: list[dict[str, str]] = data["history"]
        history.append({"role": "user", "content": user_message})
        history.append({"role": "assistant", "content": assistant_message})
        await self.save(tenant_id, phone, history, int(data["tool_call_count"]))
