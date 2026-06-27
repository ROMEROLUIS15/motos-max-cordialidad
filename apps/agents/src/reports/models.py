"""Shared data model + helpers for report templates."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


def format_cop(value: float) -> str:
    """Colombian peso formatting, e.g. 1250000 -> '$1.250.000'."""
    return "$" + f"{round(value):,}".replace(",", ".")


@dataclass
class ReportData:
    tenant_name: str
    period_label: str
    total_income: float
    completed_orders: int
    avg_ticket: float
    critical_stock: list[dict[str, Any]] = field(default_factory=list)
    top_technician: str | None = None
    # Monthly-only extras.
    previous_income: float | None = None
    income_series: list[tuple[str, float]] = field(default_factory=list)
    new_customers: int | None = None
    recurring_customers: int | None = None
