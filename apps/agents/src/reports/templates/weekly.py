"""Weekly report PDF (plain reportlab, no charts)."""

from __future__ import annotations

from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from ..models import ReportData, format_cop


def _critical_table(data: ReportData) -> Table:
    rows: list[list[str]] = [["Repuesto", "SKU", "Disponible", "Mínimo", "Sugerido"]]
    for item in data.critical_stock[:15]:
        rows.append(
            [
                str(item.get("name", "")),
                str(item.get("sku", "")),
                str(item.get("stockDisponible", "")),
                str(item.get("minStockAlert", "")),
                str(item.get("suggestedReorderQty", "")),
            ]
        )
    if len(rows) == 1:
        rows.append(["Sin repuestos críticos", "", "", "", ""])
    table = Table(rows, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0d1117")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f0f3f6")]),
            ]
        )
    )
    return table


def build_weekly_pdf(data: ReportData) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, title=f"Reporte semanal — {data.tenant_name}")
    styles = getSampleStyleSheet()
    story = []

    story.append(Paragraph(f"Reporte semanal — {data.tenant_name}", styles["Title"]))
    story.append(Paragraph(data.period_label, styles["Normal"]))
    story.append(Spacer(1, 0.6 * cm))

    story.append(Paragraph("Resumen ejecutivo", styles["Heading2"]))
    story.append(
        Paragraph(f"Ingresos totales: <b>{format_cop(data.total_income)}</b>", styles["Normal"])
    )
    story.append(
        Paragraph(f"Órdenes completadas: <b>{data.completed_orders}</b>", styles["Normal"])
    )
    story.append(
        Paragraph(f"Ticket promedio: <b>{format_cop(data.avg_ticket)}</b>", styles["Normal"])
    )
    if data.top_technician:
        story.append(
            Paragraph(f"Técnico más productivo: <b>{data.top_technician}</b>", styles["Normal"])
        )
    story.append(Spacer(1, 0.6 * cm))

    story.append(Paragraph("Stock crítico", styles["Heading2"]))
    story.append(_critical_table(data))

    doc.build(story)
    return buffer.getvalue()
