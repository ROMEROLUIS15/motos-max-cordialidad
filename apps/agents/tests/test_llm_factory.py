from collections.abc import Sequence
from typing import Any

import pytest

from src.agents.shared.llm_factory import (
    AllLLMProvidersFailedException,
    LLMFactory,
    ProviderConfig,
)
from src.config import Settings


class _Resp:
    def __init__(self, content: str) -> None:
        self.content = content


class _FakeClient:
    def __init__(self, *, content: str | None = None, fail: bool = False) -> None:
        self._content = content
        self._fail = fail

    async def ainvoke(self, messages: Sequence[Any]) -> _Resp:
        if self._fail:
            raise RuntimeError("provider down")
        assert self._content is not None
        return _Resp(self._content)


def _settings() -> Settings:
    return Settings(DEEPSEEK_API_KEY="dk", GROQ_API_KEY="gk")


def test_provider_order_is_deepseek_then_groq() -> None:
    factory = LLMFactory(_settings(), client_builder=lambda cfg, t: _FakeClient(content="x"))
    assert factory.providers == ["deepseek", "groq"]


def test_groq_uses_the_default_model() -> None:
    factory = LLMFactory(_settings(), client_builder=lambda cfg, t: _FakeClient(content="x"))
    groq = next(c for c in factory._configs if c.name == "groq")
    assert groq.model == "openai/gpt-oss-120b"


def test_groq_model_is_overridable_via_settings() -> None:
    settings = Settings(DEEPSEEK_API_KEY="dk", GROQ_API_KEY="gk", GROQ_MODEL="qwen/qwen3.6-27b")
    factory = LLMFactory(settings, client_builder=lambda cfg, t: _FakeClient(content="x"))
    groq = next(c for c in factory._configs if c.name == "groq")
    assert groq.model == "qwen/qwen3.6-27b"


def test_groq_model_falls_back_to_default_when_blank() -> None:
    # The shared .env.local ships GROQ_MODEL blank; that must not mean "no model".
    settings = Settings(DEEPSEEK_API_KEY="dk", GROQ_API_KEY="gk", GROQ_MODEL="")
    factory = LLMFactory(settings, client_builder=lambda cfg, t: _FakeClient(content="x"))
    groq = next(c for c in factory._configs if c.name == "groq")
    assert groq.model == "openai/gpt-oss-120b"


async def test_uses_primary_when_it_succeeds() -> None:
    used: list[str] = []

    def builder(cfg: ProviderConfig, temperature: float) -> _FakeClient:
        used.append(cfg.name)
        return _FakeClient(content=f"answer from {cfg.name}")

    factory = LLMFactory(_settings(), client_builder=builder)
    out = await factory.complete([{"role": "user", "content": "hola"}])
    assert out == "answer from deepseek"
    assert used == ["deepseek"]  # groq never built


async def test_falls_back_to_groq_when_deepseek_fails() -> None:
    def builder(cfg: ProviderConfig, temperature: float) -> _FakeClient:
        if cfg.name == "deepseek":
            return _FakeClient(fail=True)
        return _FakeClient(content="answer from groq")

    factory = LLMFactory(_settings(), client_builder=builder)
    out = await factory.complete([{"role": "user", "content": "hola"}])
    assert out == "answer from groq"


async def test_raises_when_all_fail() -> None:
    factory = LLMFactory(_settings(), client_builder=lambda cfg, t: _FakeClient(fail=True))
    with pytest.raises(AllLLMProvidersFailedException):
        await factory.complete([{"role": "user", "content": "hola"}])


async def test_raises_when_no_providers_configured() -> None:
    factory = LLMFactory(Settings(DEEPSEEK_API_KEY="", GROQ_API_KEY=""))
    with pytest.raises(AllLLMProvidersFailedException):
        await factory.complete([{"role": "user", "content": "hola"}])
