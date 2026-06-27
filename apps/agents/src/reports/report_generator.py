"""Orchestrates report generation: fetch data → metrics → PDF → R2 → record → notify."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import pandas as pd

from ..saas_client import SaasClient
from .models import ReportData, format_cop
from .templates.monthly import build_monthly_pdf
from .templates.weekly import build_weekly_pdf
from .uploader import R2Uploader

logger = logging.getLogger(__name__)


def _critical_from_inventory(inventory: dict[str, Any]) -> list[dict[str, Any]]:
    """Sort critical items by days remaining (most urgent first) using pandas."""
    items = inventory.get("items") or []
    if not items:
        return []
    df = pd.DataFrame(items)
    if "daysRemaining" in df.columns:
        df = df.sort_values("daysRemaining", na_position="first")
    return df.to_dict(orient="records")  # type: ignore[no-any-return]


class ReportGenerator:
    def __init__(
        self, client: SaasClient, uploader: R2Uploader, tenant_name: str = "Taller"
    ) -> None:
        self._client = client
        self._uploader = uploader
        self._tenant_name = tenant_name

    async def generate_weekly(
        self, tenant_id: str, week_start: str, week_end: str
    ) -> dict[str, Any]:
        return await self._generate(tenant_id, "WEEKLY", week_start, week_end)

    async def generate_monthly(
        self, tenant_id: str, month_start: str, month_end: str
    ) -> dict[str, Any]:
        return await self._generate(tenant_id, "MONTHLY", month_start, month_end)

    async def _generate(
        self, tenant_id: str, report_type: str, period_start: str, period_end: str
    ) -> dict[str, Any]:
        summary = await self._client.get_dashboard_summary(tenant_id, period_start, period_end)
        inventory = await self._client.get_inventory_status(tenant_id)

        data = ReportData(
            tenant_name=self._tenant_name,
            period_label=f"{period_start} — {period_end}",
            total_income=float(summary.get("totalIncome", 0)),
            completed_orders=int(summary.get("completedOrders", 0)),
            avg_ticket=float(summary.get("avgTicket", 0)),
            critical_stock=_critical_from_inventory(inventory),
        )

        builder = build_monthly_pdf if report_type == "MONTHLY" else build_weekly_pdf
        pdf = await asyncio.to_thread(builder, data)

        year = int(period_start[:4]) if period_start[:4].isdigit() else 2026
        filename = f"{report_type.lower()}-{period_start}.pdf"
        key = R2Uploader.report_key(tenant_id, report_type, year, filename)
        await asyncio.to_thread(self._uploader.upload_pdf, key, pdf)

        record = await self._client.record_report(
            tenant_id, report_type, period_start, period_end, key
        )

        await self._client.send_owner_whatsapp(
            tenant_id,
            f"📊 Tu reporte {('mensual' if report_type == 'MONTHLY' else 'semanal')} está listo "
            f"({format_cop(data.total_income)} en ingresos, {data.completed_orders} órdenes). "
            "Disponible en la plataforma.",
        )

        logger.info("report generated tenant=%s type=%s key=%s", tenant_id, report_type, key)
        return {"reportId": record.get("id"), "key": key, "bytes": len(pdf)}
