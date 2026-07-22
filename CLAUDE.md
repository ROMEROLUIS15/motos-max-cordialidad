# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

MotoWorkshop SaaS — a multi-tenant platform for motorcycle workshops (work orders, inventory, motorcycle sales, customer CRM) with a WhatsApp AI assistant. Everything is isolated per workshop (tenant). Docs are in Spanish; code and identifiers are in English. See `README.md` and `docs/` for the authoritative deep dives (`docs/ARCHITECTURE.md`, `docs/ADR.md`, `docs/SECURITY.md`, `docs/RUNBOOK.md`).

Monorepo (pnpm workspaces), 4 packages:

| Package                | Path              | Role                                       |
| ---------------------- | ----------------- | ------------------------------------------ |
| `@motoworkshop/api`    | `apps/api/`       | NestJS REST API (hexagonal architecture)   |
| `@motoworkshop/web`    | `apps/web/`       | Next.js 15 App Router frontend             |
| `@motoworkshop/agents` | `apps/agents/`    | Python FastAPI + LangGraph AI microservice |
| `@motoworkshop/types`  | `packages/types/` | Shared TypeScript types                    |

## Commands

Run from the repo root unless noted. This is a Windows machine; the shell is PowerShell (a Bash tool is also available).

```bash
pnpm dev            # Frees ports, starts Docker (Postgres+Redis), runs API+Web in parallel
pnpm dev:api        # API only  → http://localhost:3001 (global prefix /api)
pnpm dev:web        # Web only  → http://localhost:3000

pnpm typecheck      # tsc --noEmit across API + Web
pnpm lint           # ESLint across API + Web
pnpm test           # API (Jest) + Web (Vitest)
pnpm -r test:ci     # CI mode with coverage floors
pnpm format         # Prettier
```

Agents (Python 3.12, managed with `uv`), run inside `apps/agents/`:

```bash
uv sync
uv run uvicorn src.main:app --reload --port 8000
uv run ruff check src tests && uv run mypy src && uv run pytest
```

Database (Prisma), run with `--filter @motoworkshop/api` or inside `apps/api/`:

```bash
pnpm --filter @motoworkshop/api db:generate   # prisma generate (after schema edits)
pnpm --filter @motoworkshop/api db:migrate     # prisma migrate dev
pnpm --filter @motoworkshop/api db:seed        # demo tenant + demo accounts
```

### Running a single test

```bash
# API (Jest) — inside apps/api/
pnpm --filter @motoworkshop/api test -- path/to/file.spec.ts
pnpm --filter @motoworkshop/api test -- -t "name of the test"

# API end-to-end — needs a real Postgres + Redis (docker compose up -d)
pnpm --filter @motoworkshop/api test:e2e

# Web (Vitest) — inside apps/web/
pnpm --filter @motoworkshop/web test -- path/to/file.test.tsx
pnpm --filter @motoworkshop/web test:e2e   # Playwright

# Python — inside apps/agents/
uv run pytest tests/test_file.py::test_name
```

Demo accounts after seeding (local only — the production owner login differs): `owner@demo.com`, `recepcion@demo.com`, `tecnico@demo.com`, all `Demo1234!`.

## API architecture (the part that requires reading multiple files)

The NestJS API is **hexagonal / clean architecture** with strict layer boundaries under `apps/api/src/`:

- `domain/` — entities, value objects, repository _interfaces_, exceptions. Pure TypeScript, imports nothing from upper layers.
- `application/` — use-cases, application services, and **ports** (`application/ports/`, interfaces that infrastructure implements).
- `infrastructure/` — concrete adapters (Prisma persistence, JWT auth, crypto, WhatsApp messaging, R2 storage, AI, agents client, observability). Depends on application, never the reverse.
- `presentation/http/` — controllers, DTOs, guards, filters, interceptors, decorators. Orchestrates only: receive request → call use-case → return response.

**Never leak an upper layer into a lower one.** Business logic lives in use-cases, not controllers and not the Python agents. Use-cases go through domain repository interfaces / ports — not `PrismaService` directly (ADR-011).

### Dependency injection with Symbol tokens (critical convention)

NestJS cannot inject TypeScript interfaces (erased at runtime). To keep real DIP, ports/repos are provided via a `Symbol` token and injected with `@Inject`, **not** by interface type. Pattern:

```typescript
// port/interface + token live together
export const WHATSAPP_SENDER_PORT = Symbol('WHATSAPP_SENDER_PORT');
export interface WhatsAppSenderPort { /* ... */ }

// module wires the concrete adapter to the token
providers: [{ provide: WHATSAPP_SENDER_PORT, useClass: WhatsAppCloudAdapter }]

// consumer knows only the token + interface
constructor(@Inject(WHATSAPP_SENDER_PORT) private readonly sender: WhatsAppSenderPort) {}
```

When adding a repository or an adapter, follow this pattern — see `docs/ADR.md` ADR-003 and ADR-011.

### Module organization

Feature modules live at the root of `apps/api/src/` (e.g. `identity.module.ts`, `inventory.module.ts`, `sales.module.ts`, `commerce.module.ts`, `workshop.module.ts`, `agents.module.ts`, `messaging.module.ts`), all composed in `app.module.ts`. A module bundles its controllers (presentation), use-cases (application), and adapter wiring (infrastructure) across the layers above.

### Cross-service boundaries

- **Web → API**: the browser calls the NestJS API directly. Frontend fetch/session helpers are in `apps/web/src/lib/api.ts` (JWT access/refresh tokens in `localStorage`). Routes are organized by App Router **route groups** under `apps/web/src/app/`: `(auth)/` for the unauthenticated flows (login, forgot/reset password), `(dashboard)/` for every protected feature section (work-orders, inventory, sales, customers, users, settings, reports…) — all wrapped by `(dashboard)/layout.tsx`, which enforces the client-side `SessionGuard` and the shared `DashboardShell`. `app/api/` holds Next.js route handlers (not the NestJS API).
- **API ↔ Agents**: the NestJS API and the Python microservice talk over HTTP authenticated with **short-lived service-to-service JWTs**. Heavy AI logic (LangGraph agents, report PDFs, stock alerts) lives in `apps/agents/`; the API owns business logic and the agents consume API endpoints — do not move domain logic into the Python layer.
- **WhatsApp**: Meta Cloud API. `main.ts` bootstraps with `rawBody: true` specifically to verify the webhook HMAC signature — keep that.

## Conventions & guardrails

- **Multi-tenant isolation is non-negotiable.** Every data path and role/permission check is scoped by tenant (workshop). Email uniqueness is per-tenant, not global (ADR-009). Never write a query or endpoint that can cross tenants.
- **DTO validation**: a global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`) runs in `main.ts`. It only validates `@Body()` typed as a **class** DTO, not a TS `interface` — use class DTOs with `class-validator` decorators.
- **NestJS stays on v10** — migration to v11 is deliberately deferred (ADR-007). Some docs mention v11 aspirationally; `package.json` is the source of truth (v10).
- **Password hashing uses `bcryptjs`** (pure JS), not `bcrypt` — avoids native build failures on Windows (ADR-008). On Windows, if `pnpm install` fails on native modules, use `pnpm install --ignore-scripts`.
- **Rate limiting** is keyed by caller identity with ceilings derived from the client (ADR-012); see `presentation/http/rate-limit.policy.ts`.
- **Sensitive DB fields** are encrypted with AES-256-GCM (`ENCRYPTION_KEY`, 64 hex chars) — see `infrastructure/crypto/` and ADR-006.
- **Commit messages: do not add a `Co-Authored-By` trailer.**
- When behavior or a contract changes, update the affected tests and the relevant `docs/` file (ARCHITECTURE / ADR / SECURITY / RUNBOOK) in the same change.

## CI/CD & deploys

`main` is protected — merges require a PR and a green pipeline. **There is no auto-deploy**: Render (API + agents) and Cloudflare Pages (web) deploy only when CI is green, orchestrated from CI. Local git hooks enforce quality (`.husky/pre-commit` scans for secrets; `.husky/pre-push` runs typecheck + tests). Do not skip hooks or force-push `main`. Full pipeline detail is in `docs/RUNBOOK.md`.

## Local infrastructure

`docker-compose.yml` provides PostgreSQL (host port **5433**) and Redis (**6379**). `pnpm dev` starts them automatically (and starts Docker Desktop on Windows if the daemon is down). Redis backs BullMQ queues, agent sessions, and cache.
