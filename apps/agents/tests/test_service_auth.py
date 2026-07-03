"""Tests for the inbound s2s auth dependency on /agents/admin."""

from __future__ import annotations

import time
from unittest.mock import patch

import jwt
import pytest
from fastapi import HTTPException, Request

from src.api.service_auth import require_service_token
from src.config import Settings

SECRET = "test-secret"


def _request(auth: str | None = None) -> Request:
    headers = [(b"authorization", auth.encode())] if auth else []
    return Request({"type": "http", "headers": headers, "method": "POST", "path": "/agents/admin"})


def _token(token_type: str = "service", secret: str = SECRET, exp_offset: int = 300) -> str:
    now = int(time.time())
    payload = {"sub": "agents-service", "type": token_type, "iat": now, "exp": now + exp_offset}
    return jwt.encode(payload, secret, algorithm="HS256")


@pytest.fixture(autouse=True)
def _settings():
    with patch("src.api.service_auth.get_settings", return_value=Settings(JWT_SECRET=SECRET)):
        yield


def test_accepts_valid_service_token() -> None:
    require_service_token(_request(f"Bearer {_token()}"))  # no exception


def test_rejects_missing_header() -> None:
    with pytest.raises(HTTPException) as exc:
        require_service_token(_request())
    assert exc.value.status_code == 401


def test_rejects_non_bearer_header() -> None:
    with pytest.raises(HTTPException) as exc:
        require_service_token(_request("Basic abc123"))
    assert exc.value.status_code == 401


def test_rejects_wrong_signature() -> None:
    with pytest.raises(HTTPException) as exc:
        require_service_token(_request(f"Bearer {_token(secret='other-secret')}"))
    assert exc.value.status_code == 401


def test_rejects_expired_token() -> None:
    with pytest.raises(HTTPException) as exc:
        require_service_token(_request(f"Bearer {_token(exp_offset=-60)}"))
    assert exc.value.status_code == 401


def test_rejects_user_token() -> None:
    with pytest.raises(HTTPException) as exc:
        require_service_token(_request(f"Bearer {_token(token_type='access')}"))
    assert exc.value.status_code == 401
