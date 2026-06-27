"""AgentAdmin tools — thin, validated wrappers over the SaaS client.

Each tool validates its inputs with pydantic and returns the raw payload from
the NestJS ``/api/agents/*`` endpoints. The LangGraph ``execute_tool`` node
dispatches to these based on the classified intent.
"""

from __future__ import annotations

import logging
from typing import Any

from pydantic import BaseModel, Field

from ..saas_client import SaasClient

logger = logging.getLogger(__name__)


class InventoryStatusInput(BaseModel):
    tenant_id: str
    branch_id: str | None = None
    days_lookback: int = Field(default=30, ge=1, le=365)


class SalesSummaryInput(BaseModel):
    tenant_id: str
    period_start: str
    period_end: str
    branch_id: str | None = None


class PurchaseOrderInput(BaseModel):
    tenant_id: str
    items: list[dict[str, Any]] = Field(min_length=1)
    notes: str | None = None


class ReportInput(BaseModel):
    tenant_id: str
    report_type: str = "WEEKLY"
    period_start: str
    period_end: str


async def get_inventory_status(client: SaasClient, params: InventoryStatusInput) -> dict[str, Any]:
    logger.info("tool=get_inventory_status tenant=%s", params.tenant_id)
    return await client.get_inventory_status(
        params.tenant_id, params.branch_id, params.days_lookback
    )


async def get_sales_summary(client: SaasClient, params: SalesSummaryInput) -> dict[str, Any]:
    logger.info("tool=get_sales_summary tenant=%s", params.tenant_id)
    return await client.get_dashboard_summary(
        params.tenant_id, params.period_start, params.period_end, params.branch_id
    )


async def prepare_purchase_order(client: SaasClient, params: PurchaseOrderInput) -> dict[str, Any]:
    logger.info("tool=prepare_purchase_order tenant=%s n=%d", params.tenant_id, len(params.items))
    return await client.create_purchase_order_draft(params.tenant_id, params.items, params.notes)


async def trigger_report_generation(client: SaasClient, params: ReportInput) -> dict[str, Any]:
    logger.info("tool=trigger_report tenant=%s type=%s", params.tenant_id, params.report_type)
    result = await client.generate_report(
        params.tenant_id, params.report_type, params.period_start, params.period_end
    )
    return {
        "reportId": result.get("id"),
        "status": result.get("status"),
        "message": "Tu reporte estará listo en 1-2 minutos y quedará disponible en la plataforma.",
    }
