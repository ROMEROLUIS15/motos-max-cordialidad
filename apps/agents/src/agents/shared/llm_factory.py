"""LLM factory with DeepSeek (primary) → Groq (fallback).

Both providers are OpenAI-compatible, so a single ``ChatOpenAI`` adapter with a
per-provider ``base_url`` works. Providers are tried in order; the first that
answers wins. If every provider fails, ``AllLLMProvidersFailedException`` is
raised so the caller (LangGraph fallback node) can degrade gracefully.
"""

from __future__ import annotations

import logging
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Any

from ...config import Settings, get_settings

logger = logging.getLogger(__name__)


class AllLLMProvidersFailedException(Exception):
    """Raised when DeepSeek and Groq both fail for a request."""


@dataclass(frozen=True)
class ProviderConfig:
    name: str
    base_url: str
    model: str
    api_key: str


def _build_configs(settings: Settings) -> list[ProviderConfig]:
    configs: list[ProviderConfig] = []
    if settings.DEEPSEEK_API_KEY:
        configs.append(
            ProviderConfig(
                name="deepseek",
                base_url="https://api.deepseek.com/v1",
                model="deepseek-chat",
                api_key=settings.DEEPSEEK_API_KEY,
            )
        )
    if settings.GROQ_API_KEY:
        configs.append(
            ProviderConfig(
                name="groq",
                base_url="https://api.groq.com/openai/v1",
                model="openai/gpt-oss-120b",
                api_key=settings.GROQ_API_KEY,
            )
        )
    return configs


def _default_client_builder(cfg: ProviderConfig, temperature: float) -> Any:
    # Imported lazily so unit tests can inject fakes without the heavy dep.
    from langchain_openai import ChatOpenAI

    return ChatOpenAI(
        model=cfg.model,
        base_url=cfg.base_url,
        api_key=cfg.api_key,  # type: ignore[arg-type]
        temperature=temperature,
        timeout=10,
        max_retries=0,
    )


class LLMFactory:
    def __init__(
        self,
        settings: Settings | None = None,
        client_builder: Callable[[ProviderConfig, float], Any] | None = None,
    ) -> None:
        self._configs = _build_configs(settings or get_settings())
        self._build = client_builder or _default_client_builder

    @property
    def providers(self) -> list[str]:
        return [c.name for c in self._configs]

    async def complete(self, messages: Sequence[Any], temperature: float = 0.3) -> str:
        """Invoke the first provider that succeeds; return the text content."""
        if not self._configs:
            raise AllLLMProvidersFailedException("No LLM providers configured")
        last_error: Exception | None = None
        for cfg in self._configs:
            try:
                client = self._build(cfg, temperature)
                response = await client.ainvoke(messages)
                logger.info("llm provider=%s ok", cfg.name)
                content = getattr(response, "content", response)
                return content if isinstance(content, str) else str(content)
            except Exception as exc:  # noqa: BLE001 - try the next provider
                logger.warning("llm provider=%s failed: %s", cfg.name, exc)
                last_error = exc
        raise AllLLMProvidersFailedException(
            f"All LLM providers failed: {self.providers}"
        ) from last_error
