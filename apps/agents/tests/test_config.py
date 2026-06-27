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
