"""FastAPI entrypoint for the agents microservice."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

import redis.asyncio as aioredis
import sentry_sdk
from fastapi import FastAPI
from pydantic import BaseModel

from .agents.admin.agent import AdminAgent
from .agents.admin.memory import AdminSessionStore
from .agents.shared.llm_factory import LLMFactory
from .api.admin_handler import AdminHandler
from .config import get_settings
from .health import build_health
from .reports.report_generator import ReportGenerator
from .reports.uploader import R2Uploader
from .saas_client import SaasClient
from .schedulers.scheduler import build_scheduler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    if settings.SENTRY_DSN:
        sentry_sdk.init(dsn=settings.SENTRY_DSN, traces_sample_rate=0.1)
    app.state.settings = settings
    app.state.redis = aioredis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
    app.state.saas = SaasClient(settings)

    llm = LLMFactory(settings)
    agent = AdminAgent(llm=llm, client=app.state.saas)
    sessions = AdminSessionStore(app.state.redis, settings.ADMIN_SESSION_TTL_SECONDS)
    uploader = R2Uploader(settings)
    generator = ReportGenerator(app.state.saas, uploader)
    app.state.admin_handler = AdminHandler(agent, sessions, app.state.saas, generator)

    scheduler = None
    if settings.SCHEDULER_ENABLED:
        scheduler = build_scheduler(settings, app.state.saas, app.state.redis)
        scheduler.start()
    app.state.scheduler = scheduler

    logger.info("agents service started (api=%s, llm=%s)", settings.API_BASE_URL, llm.providers)
    try:
        yield
    finally:
        if scheduler is not None:
            scheduler.shutdown(wait=False)
        await app.state.saas.aclose()
        await app.state.redis.aclose()


app = FastAPI(title="MotoWorkshop Agents", version="0.1.0", lifespan=lifespan)


class AdminMessageRequest(BaseModel):
    message: str
    phoneNumber: str
    tenantId: str


@app.get("/health")
async def health() -> dict[str, Any]:
    return await build_health(app.state.redis, app.state.saas)


@app.post("/agents/admin")
async def agents_admin(req: AdminMessageRequest) -> dict[str, str]:
    handler: AdminHandler = app.state.admin_handler
    return await handler.handle(req.message, req.phoneNumber, req.tenantId)
