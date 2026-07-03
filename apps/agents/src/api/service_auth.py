"""Inbound service-to-service authentication.

Mirror of the NestJS ``ServiceAuthGuard``: requests must carry a Bearer JWT
signed with the shared ``JWT_SECRET`` whose payload has ``type: "service"``.
NestJS mints these with ``TokenFactoryService``; without a valid token the
request is rejected before reaching any handler.
"""

from __future__ import annotations

import jwt
from fastapi import HTTPException, Request

from ..config import get_settings


def require_service_token(request: Request) -> None:
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    settings = get_settings()
    try:
        payload = jwt.decode(auth_header[7:], settings.JWT_SECRET, algorithms=["HS256"])
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="Invalid service token") from exc

    if payload.get("type") != "service":
        raise HTTPException(status_code=401, detail="Service token required")
