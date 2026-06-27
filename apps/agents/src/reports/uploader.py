"""Uploads report PDFs to Cloudflare R2 (S3-compatible) and signs URLs."""

from __future__ import annotations

import logging
from typing import Any

from ..config import Settings, get_settings

logger = logging.getLogger(__name__)

PRESIGNED_TTL_SECONDS = 7 * 24 * 60 * 60  # 7 days


def _default_s3_client(settings: Settings) -> Any:
    import boto3  # lazy import so tests can inject a fake

    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name="auto",
    )


class R2Uploader:
    def __init__(self, settings: Settings | None = None, s3_client: Any | None = None) -> None:
        self._settings = settings or get_settings()
        self._bucket = self._settings.R2_BUCKET_NAME
        # Lazily built so an instance can exist without R2 creds (e.g. the
        # scheduler constructs the uploader at startup; boto3 validates the
        # endpoint eagerly and would crash the service if creds are absent).
        self._cached: Any | None = s3_client

    @property
    def _client(self) -> Any:
        if self._cached is None:
            self._cached = _default_s3_client(self._settings)
        return self._cached

    @staticmethod
    def report_key(tenant_id: str, report_type: str, year: int, filename: str) -> str:
        return f"{tenant_id}/reports/{report_type.lower()}/{year}/{filename}"

    def upload_pdf(self, key: str, data: bytes) -> None:
        self._client.put_object(
            Bucket=self._bucket, Key=key, Body=data, ContentType="application/pdf"
        )
        logger.info("uploaded report key=%s bytes=%d", key, len(data))

    def presigned_url(self, key: str, expires: int = PRESIGNED_TTL_SECONDS) -> str:
        url: str = self._client.generate_presigned_url(
            "get_object", Params={"Bucket": self._bucket, "Key": key}, ExpiresIn=expires
        )
        return url
