from typing import Any

from src.config import Settings
from src.reports.models import ReportData, format_cop
from src.reports.report_generator import ReportGenerator
from src.reports.templates.monthly import build_monthly_pdf
from src.reports.templates.weekly import build_weekly_pdf
from src.reports.uploader import R2Uploader


def _data() -> ReportData:
    return ReportData(
        tenant_name="Taller Demo",
        period_label="2026-06-01 — 2026-06-07",
        total_income=1_250_000,
        completed_orders=8,
        avg_ticket=156_250,
        critical_stock=[
            {
                "name": "Filtro",
                "sku": "F1",
                "stockDisponible": 2,
                "minStockAlert": 5,
                "suggestedReorderQty": 8,
            }
        ],
        top_technician="Carlos",
        previous_income=1_000_000,
        income_series=[("2026-06-01", 100), ("2026-06-02", 200)],
        new_customers=3,
        recurring_customers=10,
    )


def test_format_cop() -> None:
    assert format_cop(1_250_000) == "$1.250.000"


def test_weekly_pdf_is_pdf_bytes() -> None:
    pdf = build_weekly_pdf(_data())
    assert pdf[:4] == b"%PDF"
    assert len(pdf) > 1000


def test_monthly_pdf_includes_chart() -> None:
    pdf = build_monthly_pdf(_data())
    assert pdf[:4] == b"%PDF"
    assert len(pdf) > 2000  # chart image inflates the file


def test_report_key_format() -> None:
    key = R2Uploader.report_key("t1", "WEEKLY", 2026, "weekly-2026-06-01.pdf")
    assert key == "t1/reports/weekly/2026/weekly-2026-06-01.pdf"


class FakeS3:
    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}

    def put_object(self, Bucket: str, Key: str, Body: bytes, ContentType: str) -> None:  # noqa: N803
        self.objects[Key] = Body

    def generate_presigned_url(self, op: str, Params: dict[str, Any], ExpiresIn: int) -> str:  # noqa: N803
        return f"https://r2.test/{Params['Key']}?exp={ExpiresIn}"


class FakeClient:
    def __init__(self) -> None:
        self.recorded = False
        self.notified = False

    async def get_dashboard_summary(self, tenant_id, period_start, period_end, branch_id=None):  # type: ignore[no-untyped-def]
        return {"totalIncome": 1250000, "completedOrders": 8, "avgTicket": 156250}

    async def get_inventory_status(self, tenant_id, branch_id=None, days_lookback=None):  # type: ignore[no-untyped-def]
        return {
            "items": [
                {
                    "partId": "p1",
                    "name": "Filtro",
                    "daysRemaining": 3,
                    "stockDisponible": 2,
                    "minStockAlert": 5,
                }
            ]
        }

    async def record_report(self, tenant_id, report_type, period_start, period_end, pdf_r2_key):  # type: ignore[no-untyped-def]
        self.recorded = True
        return {"id": "rep-9", "status": "READY"}

    async def send_owner_whatsapp(self, tenant_id, content):  # type: ignore[no-untyped-def]
        self.notified = True
        return {"sent": True}


async def test_report_generator_weekly_end_to_end() -> None:
    client = FakeClient()
    uploader = R2Uploader(settings=Settings(R2_BUCKET_NAME="b"), s3_client=FakeS3())
    gen = ReportGenerator(client, uploader, tenant_name="Taller Demo")  # type: ignore[arg-type]

    out = await gen.generate_weekly("t1", "2026-06-01", "2026-06-07")

    assert out["reportId"] == "rep-9"
    assert out["key"] == "t1/reports/weekly/2026/weekly-2026-06-01.pdf"
    assert client.recorded is True
    assert client.notified is True
