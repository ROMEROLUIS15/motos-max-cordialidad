"""Monthly report PDF — weekly content plus a trend chart (matplotlib)."""

from __future__ import annotations

from io import BytesIO

import matplotlib

matplotlib.use("Agg")  # headless backend, must precede pyplot import
import matplotlib.pyplot as plt  # noqa: E402
from reportlab.lib.pagesizes import A4  # noqa: E402
from reportlab.lib.styles import getSampleStyleSheet  # noqa: E402
from reportlab.lib.units import cm  # noqa: E402
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer  # noqa: E402

from ..models import ReportData, format_cop  # noqa: E402
from .weekly import _critical_table  # noqa: E402


def _income_chart(data: ReportData) -> BytesIO | None:
    if not data.income_series:
        return None
    labels = [d for d, _ in data.income_series]
    values = [v for _, v in data.income_series]
    fig, ax = plt.subplots(figsize=(6, 2.5))
    ax.plot(labels, values, marker="o", color="#1f6feb")
    ax.set_title("Tendencia de ingresos")
    ax.set_ylabel("COP")
    ax.tick_params(axis="x", rotation=45, labelsize=7)
    fig.tight_layout()
    out = BytesIO()
    fig.savefig(out, format="png", dpi=120)
    plt.close(fig)
    out.seek(0)
    return out


def build_monthly_pdf(data: ReportData) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, title=f"Reporte mensual — {data.tenant_name}")
    styles = getSampleStyleSheet()
    story = []

    story.append(Paragraph(f"Reporte mensual — {data.tenant_name}", styles["Title"]))
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
    if data.previous_income is not None:
        delta = data.total_income - data.previous_income
        sign = "▲" if delta >= 0 else "▼"
        story.append(
            Paragraph(
                f"Variación vs mes anterior: <b>{sign} {format_cop(abs(delta))}</b>",
                styles["Normal"],
            )
        )
    if data.new_customers is not None and data.recurring_customers is not None:
        story.append(
            Paragraph(
                f"Clientes nuevos: <b>{data.new_customers}</b> · "
                f"recurrentes: <b>{data.recurring_customers}</b>",
                styles["Normal"],
            )
        )
    story.append(Spacer(1, 0.5 * cm))

    chart = _income_chart(data)
    if chart is not None:
        story.append(Image(chart, width=15 * cm, height=6.25 * cm))
        story.append(Spacer(1, 0.5 * cm))

    story.append(Paragraph("Stock crítico", styles["Heading2"]))
    story.append(_critical_table(data))

    doc.build(story)
    return buffer.getvalue()
