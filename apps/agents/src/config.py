"""Application settings for the agents microservice.

Loads from environment variables first, falling back to the repo-root
``.env.local`` (shared with the NestJS API) so a single file configures both
services in local development. In Docker, variables are injected by compose and
the env file is simply absent. ``extra="ignore"`` tolerates the many
NestJS-only keys that live in the same file.
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _find_env_file() -> str | None:
    """Walk up from this file looking for a repo-root ``.env.local``."""
    here = Path(__file__).resolve()
    for parent in here.parents:
        candidate = parent / ".env.local"
        if candidate.is_file():
            return str(candidate)
    return None


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_find_env_file(),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )

    # NestJS API consumed by the service client.
    API_BASE_URL: str = "http://localhost:3001"
    # Shared secret used to mint service-to-service tokens (type:"service").
    JWT_SECRET: str = "dev-secret-change-in-production"
    SERVICE_TOKEN_TTL_SECONDS: int = 300  # 5 minutes, matches TokenFactoryService

    # Redis for admin sessions and stock-alert throttling.
    REDIS_URL: str = "redis://localhost:6379"

    # LLM providers (DeepSeek primary, Groq fallback).
    DEEPSEEK_API_KEY: str = ""
    GROQ_API_KEY: str = ""

    # Cloudflare R2 (reports upload).
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = ""

    # Observability + scheduling.
    SENTRY_DSN: str = ""
    TZ: str = "America/Bogota"
    ADMIN_SESSION_TTL_SECONDS: int = 7200  # 2 hours
    SCHEDULER_ENABLED: bool = True  # disable for a second instance or local runs

    @model_validator(mode='after')
    def _check_prod_secrets(self) -> Settings:
        if os.getenv('NODE_ENV') == 'production' or os.getenv('ENV') == 'production':
            if self.JWT_SECRET == 'dev-secret-change-in-production':
                raise ValueError('JWT_SECRET must be set in production')
        return self

@lru_cache
def get_settings() -> Settings:
    return Settings()
