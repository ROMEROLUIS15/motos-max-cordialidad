from src.config import Settings
from src.health import build_health


def _settings(groq_model: str = "openai/gpt-oss-120b") -> Settings:
    return Settings(_env_file=None, GROQ_MODEL=groq_model)


class FakeRedis:
    def __init__(self, ok: bool) -> None:
        self._ok = ok

    async def ping(self) -> bool:
        if not self._ok:
            raise ConnectionError("redis down")
        return True


class FakeApi:
    def __init__(self, ok: bool) -> None:
        self._ok = ok

    async def api_health(self) -> bool:
        return self._ok


async def test_health_ok_when_both_up() -> None:
    out = await build_health(FakeRedis(True), FakeApi(True), _settings())
    assert out == {
        "status": "ok",
        "redis": True,
        "api": True,
        "llm": {"primary": "deepseek-chat", "fallback": "openai/gpt-oss-120b"},
    }


async def test_health_degraded_when_redis_down() -> None:
    out = await build_health(FakeRedis(False), FakeApi(True), _settings())
    assert out["status"] == "degraded"
    assert out["redis"] is False


async def test_health_degraded_when_api_down() -> None:
    out = await build_health(FakeRedis(True), FakeApi(False), _settings())
    assert out["status"] == "degraded"
    assert out["api"] is False


async def test_health_reports_the_configured_groq_model() -> None:
    # This is what makes the running fallback model checkable with a curl.
    out = await build_health(FakeRedis(True), FakeApi(True), _settings("qwen/qwen3.6-27b"))
    assert out["llm"]["fallback"] == "qwen/qwen3.6-27b"


async def test_health_never_exposes_api_keys() -> None:
    settings = Settings(_env_file=None, GROQ_API_KEY="gsk_secret", DEEPSEEK_API_KEY="dk_secret")
    out = await build_health(FakeRedis(True), FakeApi(True), settings)
    assert "secret" not in str(out)
