"""FastAPI entrypoint for the agents microservice."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

import redis.asyncio as aioredis
import sentry_sdk
from fastapi import FastAPI

from .config import get_settings
from .health import build_health
from .saas_client import SaasClient

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
    logger.info("agents service started (api=%s)", settings.API_BASE_URL)
    try:
        yield
    finally:
        await app.state.saas.aclose()
        await app.state.redis.aclose()


app = FastAPI(title="MotoWorkshop Agents", version="0.1.0", lifespan=lifespan)


@app.get("/health")
async def health() -> dict[str, Any]:
    return await build_health(app.state.redis, app.state.saas)
