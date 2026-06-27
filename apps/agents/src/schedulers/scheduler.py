"""Main APScheduler wiring (America/Bogota): weekly, monthly, hourly stock."""

from __future__ import annotations

import logging
from typing import Any
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from ..config import Settings
from ..reports.report_generator import ReportGenerator
from ..reports.uploader import R2Uploader
from ..saas_client import SaasClient
from .report_jobs import MonthlyReportJob, WeeklyReportJob
from .stock_alert import StockAlertJob

logger = logging.getLogger(__name__)

BOGOTA = ZoneInfo("America/Bogota")


def build_scheduler(settings: Settings, client: SaasClient, redis: Any) -> AsyncIOScheduler:
    uploader = R2Uploader(settings)

    def make_generator(tenant_name: str) -> ReportGenerator:
        return ReportGenerator(client, uploader, tenant_name=tenant_name)

    weekly = WeeklyReportJob(client, make_generator)
    monthly = MonthlyReportJob(client, make_generator)
    stock = StockAlertJob(client, redis)

    scheduler = AsyncIOScheduler(timezone=BOGOTA)
    scheduler.add_job(
        weekly.run_once, CronTrigger(day_of_week="mon", hour=8, minute=0), id="weekly_report"
    )
    scheduler.add_job(monthly.run_once, CronTrigger(day=1, hour=8, minute=0), id="monthly_report")
    scheduler.add_job(stock.run_once, IntervalTrigger(hours=1), id="stock_alert")
    logger.info("scheduler configured: weekly(mon 8am), monthly(day 1 8am), stock(hourly) — Bogota")
    return scheduler
