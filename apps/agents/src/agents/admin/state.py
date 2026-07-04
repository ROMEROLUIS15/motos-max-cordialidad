"""LangGraph state for AgentAdmin."""

from __future__ import annotations

from typing import Annotated, Any, TypedDict

from langgraph.graph.message import add_messages


class AdminAgentState(TypedDict, total=False):
    # Conversation messages (LangChain BaseMessage); add_messages appends.
    messages: Annotated[list[Any], add_messages]
    tenant_id: str
    admin_phone: str
    session_id: str
    tool_call_count: int
    intent: str
    # True only for the turn immediately after a purchase-order proposal, so a
    # bare "sí"/"confirmar" can only create a draft when one was actually offered.
    awaiting_po_confirmation: bool
    tool_data: dict[str, Any]
    final_response: str
    error: bool
