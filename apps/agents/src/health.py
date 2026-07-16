"""Health probing helpers, isolated so they can be unit-tested without FastAPI."""

from __future__ import annotations

import logging
from typing import Any, Protocol

from .config import Settings, get_settings

logger = logging.getLogger(__name__)


class _RedisLike(Protocol):
    async def ping(self) -> Any: ...


class _ApiLike(Protocol):
    async def api_health(self) -> bool: ...


async def check_redis(redis: _RedisLike) -> bool:
    try:
        await redis.ping()
        return True
    except Exception as exc:  # noqa: BLE001 - health must never raise
        logger.warning("Redis health check failed: %s", exc)
        return False


async def build_health(
    redis: _RedisLike, api: _ApiLike, settings: Settings | None = None
) -> dict[str, Any]:
    s = settings or get_settings()
    redis_ok = await check_redis(redis)
    api_ok = await api.api_health()
    status = "ok" if redis_ok and api_ok else "degraded"
    # The LLM models are reported so the running config can be checked from
    # outside the process — a model deprecation is answered with a curl instead
    # of a redeploy. Model names are not secrets; keys are never exposed.
    return {
        "status": status,
        "redis": redis_ok,
        "api": api_ok,
        "llm": {"primary": "deepseek-chat", "fallback": s.groq_model},
    }
