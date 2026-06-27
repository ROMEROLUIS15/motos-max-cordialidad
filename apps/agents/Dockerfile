FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

# uv for fast, reproducible installs.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Install dependencies first (cached layer); the project itself is not installed
# as a package — we run it from source via PYTHONPATH.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY src ./src

EXPOSE 8000
# Shell form so $PORT (injected by Render) is expanded; defaults to 8000 locally.
CMD uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-8000}
