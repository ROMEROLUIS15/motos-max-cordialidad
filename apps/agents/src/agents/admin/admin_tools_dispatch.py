"""Maps a classified intent to the right AgentAdmin tool call."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from ...saas_client import SaasClient
from ...tools.admin_tools import (
    InventoryStatusInput,
    PurchaseOrderInput,
    ReportInput,
    SalesSummaryInput,
    get_inventory_status,
    get_sales_summary,
    prepare_purchase_order,
    trigger_report_generation,
)


def default_week_period(now: datetime | None = None) -> tuple[str, str]:
    """ISO start/end (date) for the trailing 7 days, UTC."""
    end = now or datetime.now(UTC)
    start = end - timedelta(days=7)
    return start.date().isoformat(), end.date().isoformat()


async def run_for_intent(client: SaasClient, intent: str, tenant_id: str) -> dict[str, Any]:
    if intent == "INVENTORY_QUERY":
        return await get_inventory_status(client, InventoryStatusInput(tenant_id=tenant_id))
    if intent == "SALES_QUERY":
        start, end = default_week_period()
        return await get_sales_summary(
            client,
            SalesSummaryInput(tenant_id=tenant_id, period_start=start, period_end=end),
        )
    if intent == "REPORT_REQUEST":
        start, end = default_week_period()
        return await trigger_report_generation(
            client,
            ReportInput(
                tenant_id=tenant_id, report_type="WEEKLY", period_start=start, period_end=end
            ),
        )
    if intent == "PURCHASE_ORDER_REQUEST":
        return await get_inventory_status(client, InventoryStatusInput(tenant_id=tenant_id))
    if intent == "PURCHASE_ORDER_CONFIRM":
        inventory = await get_inventory_status(client, InventoryStatusInput(tenant_id=tenant_id))
        items = [
            {
                "partId": item["partId"],
                "quantity": max(1, int(item.get("suggestedReorderQty", 1))),
            }
            for item in inventory.get("items", [])
            if float(item.get("stockDisponible", 0)) < float(item.get("minStockAlert", 0))
        ]
        if not items:
            return {"message": "No hay repuestos con stock bajo para generar una orden de compra."}
        return await prepare_purchase_order(
            client,
            PurchaseOrderInput(
                tenant_id=tenant_id,
                items=items,
                notes="Orden generada automáticamente por el asistente",
            ),
        )
    return {}
