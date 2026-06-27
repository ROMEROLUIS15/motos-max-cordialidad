from src.health import build_health


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
    out = await build_health(FakeRedis(True), FakeApi(True))
    assert out == {"status": "ok", "redis": True, "api": True}


async def test_health_degraded_when_redis_down() -> None:
    out = await build_health(FakeRedis(False), FakeApi(True))
    assert out["status"] == "degraded"
    assert out["redis"] is False


async def test_health_degraded_when_api_down() -> None:
    out = await build_health(FakeRedis(True), FakeApi(False))
    assert out["status"] == "degraded"
    assert out["api"] is False
