# MotoWorkshop Agents (`apps/agents`)

Python microservice (FastAPI + LangGraph) for the Fase 2 multi-agent system:
AgentAdmin (admin Q&A over WhatsApp), automatic reports, and proactive stock
alerts. It consumes the NestJS `/api/agents/*` endpoints with short-lived
service tokens (`type:"service"`, signed with the shared `JWT_SECRET`).

## Stack

- FastAPI + uvicorn (HTTP)
- LangGraph / LangChain (AgentAdmin graph) — Fase 2B-2+
- httpx (`saas_client.py`) — typed client for the NestJS API
- Redis (admin sessions + alert throttling)
- APScheduler (cron jobs) — Fase 2C
- uv for dependency management

## Local development

```bash
cd apps/agents
uv sync                      # create .venv + install deps
uv run uvicorn src.main:app --reload --port 8000
uv run pytest                # tests
uv run ruff check src tests  # lint
uv run mypy src              # type-check
```

Settings load from environment, falling back to the repo-root `.env.local`
(shared with the API). Key vars: `API_BASE_URL`, `JWT_SECRET`, `REDIS_URL`,
`DEEPSEEK_API_KEY`, `GROQ_API_KEY`, `R2_*`, `SENTRY_DSN`.

## Docker

```bash
docker compose build agents
docker compose up agents     # serves on :8000, reaches the host API via host.docker.internal
```

## Endpoints

- `GET /health` → `{ status: "ok"|"degraded", redis: bool, api: bool }`
