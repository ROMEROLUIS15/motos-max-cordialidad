"""Handles admin WhatsApp messages routed from NestJS (Fase 2C).

Flow: NestJS webhook detects an OWNER number → POST /agents/admin → here we load
the Redis session, run the AgentAdmin graph, persist the turn, and send the
reply back to the admin through the NestJS WhatsApp endpoint.
"""

from __future__ import annotations

import logging

from ..agents.admin.agent import AdminAgent
from ..agents.admin.memory import AdminSessionStore
from ..saas_client import SaasClient

logger = logging.getLogger(__name__)


class AdminHandler:
    def __init__(self, agent: AdminAgent, sessions: AdminSessionStore, client: SaasClient) -> None:
        self._agent = agent
        self._sessions = sessions
        self._client = client

    async def handle(self, message: str, phone: str, tenant_id: str) -> dict[str, str]:
        session = await self._sessions.load(tenant_id, phone)
        session_id = f"{tenant_id}:{phone}"
        reply = await self._agent.answer(
            message,
            tenant_id=tenant_id,
            admin_phone=phone,
            session_id=session_id,
            tool_call_count=int(session.get("tool_call_count", 0)),
        )
        await self._sessions.record_turn(tenant_id, phone, message, reply)
        try:
            await self._client.send_owner_whatsapp(tenant_id, reply)
        except Exception as exc:  # noqa: BLE001 - reply still computed; log and report
            logger.warning("failed to send admin reply for %s: %s", phone, exc)
        return {"status": "ok", "reply": reply}
