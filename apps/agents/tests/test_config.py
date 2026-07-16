import pytest

from src.config import Settings


def test_defaults() -> None:
    s = Settings(JWT_SECRET="x")
    assert s.SERVICE_TOKEN_TTL_SECONDS == 300
    assert s.ADMIN_SESSION_TTL_SECONDS == 7200
    assert s.TZ == "America/Bogota"
    assert s.API_BASE_URL.startswith("http")


def test_explicit_overrides_win() -> None:
    s = Settings(JWT_SECRET="secret", API_BASE_URL="http://example.test")
    assert s.JWT_SECRET == "secret"
    assert s.API_BASE_URL == "http://example.test"


# GROQ_MODEL exists so a Groq model deprecation is a config change instead of a
# deploy. These read it from the real environment (not via kwargs), which is how
# Render supplies it: passing it as an argument would not prove that at all.


def test_groq_model_defaults_when_env_is_absent(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GROQ_MODEL", raising=False)
    s = Settings(_env_file=None)
    assert s.GROQ_MODEL == "openai/gpt-oss-120b"
    assert s.groq_model == "openai/gpt-oss-120b"


def test_groq_model_is_read_from_the_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GROQ_MODEL", "qwen/qwen3.6-27b")
    s = Settings(_env_file=None)
    assert s.groq_model == "qwen/qwen3.6-27b"


def test_blank_groq_model_env_falls_back_to_default(monkeypatch: pytest.MonkeyPatch) -> None:
    # The shared .env.local ships the key blank; that must not mean "no model".
    monkeypatch.setenv("GROQ_MODEL", "")
    s = Settings(_env_file=None)
    assert s.GROQ_MODEL == ""
    assert s.groq_model == "openai/gpt-oss-120b"
