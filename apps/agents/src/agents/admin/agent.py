"""AgentAdmin — LangGraph graph that answers the workshop admin's questions.

Flow:  classify_intent → (execute_tool | respond) → respond → END
Any node failure or exceeding the tool-call budget routes to ``fallback``.
The LLM is provided by :class:`LLMFactory` (DeepSeek→Groq); tool data comes
from the NestJS API via :class:`SaasClient`.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import sentry_sdk
from langchain_core.messages import AIMessage, HumanMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph

from ...saas_client import SaasClient
from ..shared.llm_factory import LLMFactory
from . import admin_tools_dispatch as dispatch
from . import prompts
from .state import AdminAgentState

logger = logging.getLogger(__name__)

MAX_TOOL_CALLS = 5
VALID_INTENTS = {
    "SALES_QUERY",
    "INVENTORY_QUERY",
    "REPORT_REQUEST",
    "PURCHASE_ORDER_REQUEST",
    "PURCHASE_ORDER_CONFIRM",
    "GENERAL",
}


def _last_user_text(state: AdminAgentState) -> str:
    messages = state.get("messages") or []
    for msg in reversed(messages):
        content = getattr(msg, "content", None)
        if content:
            return str(content)
    return ""


class AdminAgent:
    def __init__(self, llm: LLMFactory, client: SaasClient) -> None:
        self._llm = llm
        self._client = client
        self._graph = self._build()

    # --- graph wiring ----------------------------------------------------
    def _build(self) -> Any:
        g: StateGraph[AdminAgentState] = StateGraph(AdminAgentState)
        g.add_node("classify_intent", self._classify_intent)
        g.add_node("execute_tool", self._execute_tool)
        g.add_node("respond", self._respond)
        g.add_node("fallback", self._fallback)

        g.set_entry_point("classify_intent")
        g.add_conditional_edges(
            "classify_intent",
            self._after_classify,
            {"tool": "execute_tool", "respond": "respond", "fallback": "fallback"},
        )
        g.add_conditional_edges(
            "execute_tool",
            self._after_tool,
            {"respond": "respond", "fallback": "fallback"},
        )
        g.add_edge("respond", END)
        g.add_edge("fallback", END)
        return g.compile(checkpointer=MemorySaver())

    # --- nodes -----------------------------------------------------------
    async def _classify_intent(self, state: AdminAgentState) -> dict[str, Any]:
        message = _last_user_text(state)
        awaiting = bool(state.get("awaiting_po_confirmation"))
        try:
            raw = await self._llm.complete(
                [
                    {"role": "system", "content": prompts.SYSTEM_PROMPT},
                    {"role": "user", "content": prompts.CLASSIFY_PROMPT.format(message=message)},
                ],
                temperature=0.0,
            )
            intent = raw.strip().upper()
            intent = next((i for i in VALID_INTENTS if i in intent), "GENERAL")
            # A confirmation ("sí", "dale", "confirmar") only counts when we
            # actually proposed a purchase order on the previous turn. Otherwise
            # the LLM can misread an unrelated affirmation as a PO confirmation
            # and create a spurious draft. Downgrade to a plain reply instead.
            if intent == "PURCHASE_ORDER_CONFIRM" and not awaiting:
                logger.info("PO confirm ignored — no pending purchase-order proposal")
                intent = "GENERAL"
            # We await a confirmation only right after proposing a PO; any other
            # intent (including the confirm itself) clears the pending state.
            next_awaiting = intent == "PURCHASE_ORDER_REQUEST"
            logger.info("classify intent=%s awaiting=%s", intent, next_awaiting)
            return {"intent": intent, "awaiting_po_confirmation": next_awaiting}
        except Exception as exc:  # noqa: BLE001
            logger.warning("classify failed: %s", exc)
            return {"error": True}

    def _after_classify(self, state: AdminAgentState) -> str:
        if state.get("error"):
            return "fallback"
        if (state.get("tool_call_count") or 0) >= MAX_TOOL_CALLS:
            logger.warning("tool-call budget reached — skipping tool")
            return "respond"
        return "respond" if state.get("intent") == "GENERAL" else "tool"

    async def _execute_tool(self, state: AdminAgentState) -> dict[str, Any]:
        intent = state.get("intent", "GENERAL")
        tenant_id = state["tenant_id"]
        count = (state.get("tool_call_count") or 0) + 1
        try:
            data = await dispatch.run_for_intent(self._client, intent, tenant_id)
            return {"tool_data": data, "tool_call_count": count}
        except Exception as exc:  # noqa: BLE001
            logger.warning("execute_tool failed: %s", exc)
            return {"error": True, "tool_call_count": count}

    def _after_tool(self, state: AdminAgentState) -> str:
        return "fallback" if state.get("error") else "respond"

    async def _respond(self, state: AdminAgentState) -> dict[str, Any]:
        message = _last_user_text(state)
        intent = state.get("intent", "GENERAL")
        try:
            if intent == "GENERAL":
                user_prompt = prompts.GENERAL_PROMPT.format(message=message)
            else:
                tool_data = json.dumps(state.get("tool_data", {}), ensure_ascii=False, default=str)
                user_prompt = prompts.RESPONSE_PROMPT.format(message=message, tool_data=tool_data)
            text = await self._llm.complete(
                [
                    {"role": "system", "content": prompts.SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.3,
            )
            return {"final_response": text.strip(), "messages": [AIMessage(content=text.strip())]}
        except Exception as exc:  # noqa: BLE001
            logger.warning("respond failed: %s", exc)
            return {"error": True}

    def _fallback(self, state: AdminAgentState) -> dict[str, Any]:
        sentry_sdk.capture_message("AgentAdmin fallback triggered")
        return {
            "final_response": prompts.FALLBACK_MESSAGE,
            "messages": [AIMessage(content=prompts.FALLBACK_MESSAGE)],
        }

    # --- public API ------------------------------------------------------
    async def answer(
        self,
        message: str,
        tenant_id: str,
        admin_phone: str,
        session_id: str,
        tool_call_count: int = 0,
        history: list[dict[str, str]] | None = None,
        awaiting_po_confirmation: bool = False,
    ) -> tuple[str, str, bool]:
        """Run one turn.

        Returns ``(reply, detected intent, awaiting_po_confirmation)`` — the last
        flag must be persisted by the caller and passed back on the next turn so
        a purchase-order confirmation is only honored right after it was offered.
        """
        messages: list[Any] = []
        if history:
            recent = history[-20:]
            for entry in recent:
                if entry.get("role") == "user":
                    messages.append(HumanMessage(content=entry["content"]))
                elif entry.get("role") == "assistant":
                    messages.append(AIMessage(content=entry["content"]))
        messages.append(HumanMessage(content=message))
        initial: AdminAgentState = {
            "messages": messages,
            "tenant_id": tenant_id,
            "admin_phone": admin_phone,
            "session_id": session_id,
            "tool_call_count": tool_call_count,
            "awaiting_po_confirmation": awaiting_po_confirmation,
        }
        config = {"configurable": {"thread_id": session_id}}
        final: AdminAgentState = await self._graph.ainvoke(initial, config=config)
        reply = final.get("final_response") or prompts.FALLBACK_MESSAGE
        intent = final.get("intent", "GENERAL")
        awaiting = bool(final.get("awaiting_po_confirmation"))
        return reply, intent, awaiting
