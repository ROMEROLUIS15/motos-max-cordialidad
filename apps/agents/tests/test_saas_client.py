import httpx
import jwt
import pytest

from src.config import Settings
from src.saas_client import SaasClient

SECRET = "test-secret"


def _client(handler: httpx.MockTransport) -> SaasClient:
    settings = Settings(JWT_SECRET=SECRET, API_BASE_URL="http://api.test")
    http = httpx.AsyncClient(transport=handler, base_url="http://api.test")
    return SaasClient(settings=settings, client=http)


def test_service_token_claims() -> None:
    settings = Settings(JWT_SECRET=SECRET)
    token = SaasClient(settings=settings)._service_token()
    decoded = jwt.decode(token, SECRET, algorithms=["HS256"])
    assert decoded["sub"] == "agents-service"
    assert decoded["type"] == "service"
    assert decoded["exp"] - decoded["iat"] == 300


async def test_get_active_tenants_sends_service_token() -> None:
    captured: dict[str, str] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["auth"] = request.headers.get("authorization", "")
        return httpx.Response(200, json=[{"id": "t1", "name": "Demo"}])

    client = _client(httpx.MockTransport(handler))
    tenants = await client.get_active_tenants()
    await client.aclose()

    assert tenants[0]["id"] == "t1"
    assert captured["auth"].startswith("Bearer ")
    decoded = jwt.decode(captured["auth"].removeprefix("Bearer "), SECRET, algorithms=["HS256"])
    assert decoded["type"] == "service"


async def test_retries_on_503_then_succeeds() -> None:
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] == 1:
            return httpx.Response(503, text="unavailable")
        return httpx.Response(200, json={"ok": True})

    client = _client(httpx.MockTransport(handler))
    out = await client.get_dashboard_summary("t1", "2026-01-01", "2026-12-31")
    await client.aclose()

    assert out == {"ok": True}
    assert calls["n"] == 2


async def test_does_not_retry_on_400() -> None:
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(400, json={"message": "bad"})

    client = _client(httpx.MockTransport(handler))
    with pytest.raises(httpx.HTTPStatusError):
        await client.get_inventory_status("t1")
    await client.aclose()

    assert calls["n"] == 1


async def test_api_health_true_on_200() -> None:
    client = _client(httpx.MockTransport(lambda req: httpx.Response(200, json={"status": "ok"})))
    assert await client.api_health() is True
    await client.aclose()
