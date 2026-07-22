# Runbook — MotoWorkshop SaaS

**🌐 English** · [Español](./RUNBOOK.md)

---

## Service inventory (production)

| Service              | Provider         | Plan  | URL                                        | Keep-alive   |
| -------------------- | ---------------- | ----- | ------------------------------------------ | ------------ |
| **API (NestJS)**     | Render           | Free  | `https://motoworkshop-api.onrender.com`    | Every 10 min |
| **Web (Next.js)**    | Cloudflare Pages | Free  | `https://motos-max-cordialidad.pages.dev`  | — (edge)     |
| **Agents (FastAPI)** | Render           | Free  | `https://motoworkshop-agents.onrender.com` | Every 10 min |
| **Database**         | Neon             | Free  | (connection via DATABASE_URL)              | —            |
| **Redis**            | <TBD>            | <TBD> | (connection via REDIS_URL)                 | —            |
| **Object Storage**   | Cloudflare R2    | Free  | (via R2_PUBLIC_URL)                        | —            |
| **Monitoring**       | Sentry           | Free  | `sentry.io`                                | —            |

---

## Environment variables per service

### API (Render — `motoworkshop-api`)

All of `.env.local.example` except the web-specific ones:

- `DATABASE_URL`, `REDIS_URL`
- `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`
- `ENCRYPTION_KEY`
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`
- `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`
- `WHATSAPP_UTILITY_TEMPLATE` (optional) — name of an **approved utility template** in Meta with a single body parameter. Example: name `notificacion_taller`, language **plain Spanish** (the code sends `code: 'es'`; a variant like es_MX errors with 132001), body: "Hola, tienes una novedad de tu taller: {{1}}. Si tienes alguna duda, responde a este mensaje." — note: Meta **rejects** templates whose body starts or ends with the variable, and only body parameters are filled (no header variable, no dynamic buttons). If configured, messages outside the 24h window are sent with this template instead of free text (which Meta rejects with error 131047). If unset, free text is attempted and the failure stays visible (message FAILED + in-app notification to admins).
- `WHATSAPP_API_VERSION` (optional, default `v21.0`) — Graph API version; allows the bump without touching code when Meta retires the current version (~2 years of support per version).
- `DEEPSEEK_API_KEY`, `GROQ_API_KEY`
- `GROQ_MODEL` (optional, default `openai/gpt-oss-120b`) — the Groq model; allows the change without touching code when Groq deprecates the current model (they warn by email with ~1 month's notice). Current models at https://console.groq.com/docs/models. It must support tool calling (the RouterAgent uses it). Empty = default.
- `SENTRY_DSN`
- `NODE_ENV=production`, `ALLOWED_ORIGINS`
- `AGENTS_BASE_URL`, `SERVICE_TOKEN_TTL_SECONDS`
- `TZ=America/Bogota`
- `PORT=3001`

### Web (Cloudflare Pages — `motoworkshop-web`)

Configured in the Cloudflare Pages dashboard > Settings > Environment variables:

- `NEXT_PUBLIC_API_URL=https://motoworkshop-api.onrender.com`
- `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`
- `SENTRY_ORG`, `SENTRY_PROJECT`

### Agents (Render — `motoworkshop-agents`)

- `DATABASE_URL` (read access for queries)
- `REDIS_URL`
- `JWT_SECRET` (shared with the API, to sign/verify service tokens)
- `API_BASE_URL=https://motoworkshop-api.onrender.com`
- `DEEPSEEK_API_KEY`, `GROQ_API_KEY`
- `GROQ_MODEL` (optional, default `openai/gpt-oss-120b`) — same as in the API; both services read it separately, so a model change must be made **in both**. A variable change in Render **does not apply until the next deploy** (`autoDeployTrigger: off`): after changing it, redeploy. The model the process is actually using is checked with `curl https://motoworkshop-agents.onrender.com/health` → `llm.fallback` field (the API does not expose its own; it uses the same value).
- `SENTRY_DSN`
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`
- `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`
- `ADMIN_SESSION_TTL_SECONDS=7200`, `SERVICE_TOKEN_TTL_SECONDS=300`
- `SCHEDULER_ENABLED=true`
- `TZ=America/Bogota`
- `PORT=8000`

> Secrets (`sync: false`) configured in `render.yaml`. Do not include values in the blueprint.

---

## Deployment

Nothing deploys if the CI pipeline is not green. See ["CI/CD pipeline"](#cicd-pipeline) below for the full detail; this section covers only each service's mechanism.

### API (NestJS) — Render

```yaml
# render.yaml
service:
  name: motoworkshop-api
  type: web
  runtime: docker
  dockerfile: apps/api/Dockerfile
  dockerContext: .
  plan: free
  healthCheckPath: /api/health
  autoDeployTrigger: off # Render does NOT trigger the deploy — CI orchestrates it
```

Render's native auto-deploy is disabled on purpose. The `deploy-api` job in `ci.yml` triggers the deploy via the Render API (`POST /v1/services/{id}/deploys`) **only after** all checks (typecheck, tests, lint, e2e, secrets, audit) pass, and waits for the status to be `live` before continuing with the smoke test. This avoids a deadlock that would occur if `autoDeployTrigger: checksPass` were used instead alongside a verification job in the same pipeline (Render would wait for the check, the check would wait for Render).

**Build**: multistage Docker (install → build → copy artifacts → final image). Migrations and the seed run inside the container's `CMD` at startup (see ["Database migrations"](#database-migrations)) — Render's free plan does not offer a `preDeployCommand` as a separate step.

### Web (Next.js) — Cloudflare Pages

The production deploy runs in the `deploy-web` job of `ci.yml`, gated by the same checks as the API. Since 2026-07-05 the job **does not build or upload artifacts**: it triggers **Cloudflare's server-side build** via the Pages API and waits for the result:

```bash
# 1. Create the deployment (Cloudflare clones the repo and builds with its own environment)
POST /accounts/{account}/pages/projects/motos-max-cordialidad/deployments  -F branch=main
# 2. Poll latest_stage until deploy:success (or failure)
# 3. Post-deploy verification: GET /customers/<uuid> must respond ≠ 500
```

Step 3 exists because a deploy can "succeed" with a broken worker (incident 2026-07-04: outdated production `compatibility_date` → all dynamic routes at 500 while the static ones responded 200 and the smoke test passed). A static-route smoke test does **not** detect a broken edge worker.

> **Do not create `apps/web/wrangler.toml`.** `wrangler pages deploy` syncs any present `wrangler.toml` with the project config in the Cloudflare dashboard — including `compatibility_flags`, `compatibility_date` and `destination_dir`. That is how the production config got overwritten with a 2024 date (see troubleshooting). The current flow no longer uses wrangler, but the warning still stands for any manual deploy.

`.github/workflows/pages.yml` (`workflow_dispatch`, manual) remains as a functional backup — it uses the same server-side build mechanism.

### Agents (Python) — Render

Same mechanism as the API: `autoDeployTrigger: off`, the `deploy-agents` job in `ci.yml` orchestrates the deploy via the Render API. This job additionally only runs if the commit diff touches `apps/agents/**` — a change only in `apps/web` or `apps/api` does not redeploy the agents microservice.

---

## Database migrations

```bash
# Local / manual
pnpm --filter @motoworkshop/api db:migrate
# Internally runs: npx prisma migrate dev (creates+applies migration)

# NEVER use against production:
# ❌ npx prisma migrate dev  (would reset data)
# ❌ npx prisma db push       (would skip validations)
```

In **production**, the migration runs automatically inside the API container's `CMD` at startup — `npx prisma migrate deploy && node dist-seed/prisma/seed.js && node dist/main` — there is no separate step or dedicated GitHub Action. Two reasons: Render's free plan does not offer a `preDeployCommand`, and Neon is not reliably reachable from outside Render's network to run the seed manually. The seed is idempotent (uses `upsert`/existence checks), so retrying it at every startup is safe.

---

## Rollback

### Render (API and Agents)

1. Go to the Render dashboard > service > **Deploy History**.
2. Identify the commit before the incident.
3. Click **"Deploy"** next to that commit.
4. Render will rebuild and deploy that version.

### Cloudflare Pages (Web)

1. Cloudflare Pages dashboard > **Deployments**.
2. Find the previous successful deployment.
3. Click **"..."** > **"Rollback to this deployment"**.

---

## Health Checks

| Service       | Endpoint          | Expected response                                                                                                              |
| ------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| NestJS API    | `GET /api/health` | `200 { "status": "ok" }`                                                                                                       |
| Python Agents | `GET /health`     | `200 { "status": "ok", "redis": true, "api": true, "llm": { "primary": "deepseek-chat", "fallback": "openai/gpt-oss-120b" } }` |

Render uses these endpoints to determine whether the service is alive, and the `smoke-web`/keep-alive job hits them every 10 minutes to prevent the free plan from going to sleep.

> **Implementation note**: there is a second controller (`HealthController` in `health.controller.ts`) that exposes a more detailed check (Postgres status, and whether Redis/R2/WhatsApp are configured) also under `/health`. `AppController` registers its own `health` route first, so in practice `GET /api/health` always returns the simple shape above. If the per-component detail is needed, expose it under its own route (e.g. `/api/health/detail`) instead of relying on controller registration order.

---

## Monitoring

- **Sentry**: Captures unhandled errors in the API (NestJS global filter) and Agents (Sentry SDK).
- **Logs**: Render dashboard > service > **Logs**.
- **Keep-alive**: a GitHub Action every 10 minutes prevents the Render free services from going to sleep.

---

## CI/CD pipeline

Every push to `main` runs the same sequence; nothing deploys if a check fails.

**Checks (`ci.yml`, in parallel):**

| Check           | What it validates                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| Typecheck       | `tsc --noEmit` on API and Web                                                                                   |
| Test            | Jest (API) + Vitest (Web), with a coverage floor                                                                |
| Lint            | ESLint on API and Web                                                                                           |
| Agents (Python) | `ruff check` + `ruff format --check` + `mypy` + `pytest`                                                        |
| E2E API         | Suites against ephemeral Postgres + Redis on the runner, includes the migrations gate (`prisma migrate deploy`) |
| E2E Web         | Playwright (Chromium) against mocked specs                                                                      |
| Secrets scan    | `gitleaks-action` over the diff                                                                                 |
| Audit           | `pnpm audit --prod --audit-level high` (with the exceptions documented in `SECURITY.md`)                        |

**Deploys (only if the 8 checks above pass):** `deploy-web` (Cloudflare Pages) → `smoke-web` (verifies `/`, `/login`, `/reset-password/help` with real content) in parallel with `deploy-api` / `deploy-agents` (Render, orchestrated via API — see above) → post-deploy health verification.

**`main` branch protection**: 8 required checks + a mandatory pull request. A failure at any step — including a post-deploy smoke test — triggers a notification email to the team (`notify-failure`) so a broken deploy does not go unnoticed.

---

## Troubleshooting common problems

### Slow API on the first request

**Problem**: Render's free tier "sleeps" the container after 15 min of inactivity. The first request can take ~50s (cold start).

**Solution**: The keep-alive every 10 min reduces the window but does not eliminate the cold start entirely. Consider the Starter plan ($7/mo) if latency is critical.

### Redis down

**Symptom**: The WhatsApp queue does not process messages, agent sessions fail, login is slow.

**Impact**: Partial degradation. The API keeps working (Redis is cache/queue, not primary storage). Incoming WhatsApp messages are lost until Redis recovers.

**Action**: Check the Redis provider's status. Restart if necessary.

### LLM out of credit (DeepSeek / Groq)

**Symptom**: The agents (WhatsApp RouterAgent or AgentAdmin) respond with errors or "I couldn't process your request". Logs show `429` or `401`.

**Impact**: Agents only. The rest of the system works normally.

**Action**: Top up the provider's credit. The system has a fallback: if DeepSeek fails, it tries Groq (`LLMProviderFactory`). If both fail, the agent escalates to a human.

### WhatsApp webhook does not respond

**Symptom**: Incoming WhatsApp messages generate no reply.

**Diagnosis**:

1. Verify that `WHATSAPP_VERIFY_TOKEN` matches between Meta and the environment variable.
2. Verify that the `webhook` is configured in the Meta Business Dashboard pointing to `https://motoworkshop-api.onrender.com/api/webhooks/whatsapp` (the verification GET and the message POST both live on that route — `whatsapp-webhook.controller.ts`).
3. Review the API logs in Render.

### Outbound WhatsApp messages fail (WHATSAPP_SEND_FAILED notification)

**Symptom**: an in-app `WHATSAPP_SEND_FAILED` notification arrives, or there are messages with `FAILED` status in the Messages section.

> ⚠️ **Verified real state 2026-07-04**: the `WHATSAPP_*` variables **do not exist in Render**
> (verified via API: no PHONE_NUMBER_ID, no ACCESS_TOKEN, no APP_SECRET, no VERIFY_TOKEN).
> The production WhatsApp channel **has never been connected to Meta**: every send fails
> with Graph code 100 ("Object with ID 'messages' does not exist" — empty phone id) and the
> incoming webhook would reject any POST for a missing signature. Automatic messages to
> customers ("your bike is ready", delivery alerts) have never been delivered. To activate the
> channel: create the app in Meta for Developers, obtain PHONE_NUMBER_ID + a System User token,
> and configure the 4 variables in Render. While they are absent, the system marks messages
> FAILED with a warn in the logs and does **not** generate in-app notifications (to avoid flooding the admin).

**Diagnosis** (the notification's `metaCode` field indicates the cause):

- **First**: verify that the 4 `WHATSAPP_*` variables exist in Render (see the warning above). `metaCode: 100` with "Object with ID 'messages'" = empty `WHATSAPP_PHONE_NUMBER_ID`.
- `metaCode: 131047` — the message was business-initiated (e.g. "your bike is ready", scheduler alerts) and the customer did not write in the last 24h. Meta only allows approved templates outside that window. **Action**: approve a utility template in the Meta Business Manager (WhatsApp Manager → Templates → "Utility" category, body with one `{{1}}` parameter) and set its name in `WHATSAPP_UTILITY_TEMPLATE`; the system uses it automatically when it detects the window is closed.
- `metaCode: 190` (or HTTP 401) — `WHATSAPP_ACCESS_TOKEN` expired or revoked. **Important**: the token must be a **System User** one (Meta Business Settings → Users → System users → generate a token with `whatsapp_business_messaging` permission), which does not expire. A normal user token lasts 60 days and dies silently.
- Other 4xx — invalid payload or number; check the logs (the error is no longer retried: 4xx fail fast).
- No `metaCode` — network/5xx failure after 3 retries (30s/60s/120s backoff); usually self-resolves, check Meta's status.

### Cloudflare Pages build fails: "routes not configured to run with the Edge Runtime"

**Symptom**: the CI "Deploy Web (Cloudflare Pages)" job fails with `Failed to produce a Cloudflare Pages build from the project` pointing to one or more dynamic routes (`[id]`, `[slug]`).

**Cause**: every dynamic (non-static) route under `apps/web/src/app` needs `export const runtime = 'edge';`, because Cloudflare Workers only runs the Edge Runtime, never Node.js. That export can look like "dead code" reading only the component (especially if the page is `'use client'`, where the server runtime is not obvious) — **it is not**: its only purpose is to satisfy the `@cloudflare/next-on-pages` build.

**Action**: if it was removed by mistake, restore the export in each file the build log points to (`git log -p -- <file>` to see when it was added/removed). There is no way to verify this with local `next build` or `pnpm --filter web typecheck` — neither fails without the export; only the real `@cloudflare/next-on-pages` build detects it, and on Windows that build does not run locally (see below), so the real check only happens in CI (Linux).

**Local Windows**: `npx @cloudflare/next-on-pages` / `pnpm dlx @cloudflare/next-on-pages` fail with `spawn npx/pnpm ENOENT` — a known bug of the Vercel CLI (which next-on-pages invokes internally) on Windows, not the project. Verify only with local `next build`; the real Cloudflare build runs in CI.

### Dynamic routes ([id]) return 500 in production but previews work

**Symptom**: `/work-orders/<id>`, `/customers/<id>`, `/vehicles/<id>` respond `Internal Server Error` (plain text, `x-matched-path` header present) on `motos-max-cordialidad.pages.dev`, while the static routes (`/`, `/login`) return 200 — and the SAME commit deployed as a preview (URL `<hash>.motos-max-cordialidad.pages.dev` of a branch) works.

**Cause (incident 2026-07-04)**: the Pages project's **production** config differs from the preview's. In the real incident, `deployment_configs.production.compatibility_date` was left at `2024-01-01` (residue from the wrangler.toml incident recovery) — the worker ran with a 2024 runtime, unable to execute Next 15.5. The previews had the correct date, which made every per-commit bisect come back "green" and mislead toward the code.

**Diagnosis**: compare both configs — `GET /accounts/{account}/pages/projects/motos-max-cordialidad` → `deployment_configs.preview` vs `.production` (compatibility_date, compatibility_flags, env_vars).

**Action**: `PATCH` the project matching production to preview (compatibility*date, `compatibility_flags:["nodejs_compat"]`, env vars `NEXT_PUBLIC*\*`), then redeploy (`POST .../deployments -F branch=main`). The CI "Verify dynamic route" step exists precisely to catch this: a static-route smoke test does NOT detect a broken worker.

### Web e2e fail in a loop with "Demasiados intentos. Intenta de nuevo en 5 minutos."

**Cause**: `POST /api/auth/login` has a real throttle of 5 attempts / 5 minutes per IP (see [SECURITY.en.md](SECURITY.en.md#rate-limiting)). Each spec in `apps/web/e2e/*.spec.ts` performs a real login against the local API — running the whole suite several times in a row (or in parallel with several workers) exhausts the quota.

**Action**: wait for the window to expire (or poll: `curl -X POST .../api/auth/login` until it stops responding `429`) before retrying. This is not a test bug; it is the rate limit working as designed.

### The app responds 429 under normal usage (or a screen stops refreshing itself)

**Symptom**: requests rejected with `429` without anyone doing anything unusual. The silent variant is worse: the notification bell or a self-refreshing screen stops updating, with no visible error — a background refresh that receives `429` has no one watching.

**Common cause**: a route's hourly ceiling fell below the traffic the client itself generates. The frontend refreshes several screens on a timer (`usePolling`), so an open tab produces constant requests without user intervention: at a 30s interval that's 120/hour **per screen**.

**Diagnosis**:

```bash
# Which route is being limited? The 429 responds with the standard header
curl -i -H "Authorization: Bearer $TOKEN" https://motoworkshop-api.onrender.com/api/notifications/unread-count | head -12
```

**Action**: do not raise the number by eye. The ceiling is derived from the client interval in `apps/api/src/presentation/http/rate-limit.policy.ts`, and `rate-limit.policy.spec.ts` verifies in CI that no `apps/web` interval approaches the limit. If a new screen starts polling faster, that test fails and points to the file: the fix is to adjust the interval or the headroom, in the same place where the formula lives. See [ADR-012](ADR.en.md) and [SECURITY.en.md](SECURITY.en.md#rate-limiting).

**Note on the key**: the counter is per **user** on authenticated routes, not per IP, so employees of the same workshop do not share a quota even if they exit through the same router. If `429` appears on anonymous routes (login, forgot-password), there the key is indeed the IP and the strict limit is intentional.

### Scheduler does not run reports

**Symptom**: Weekly/monthly reports are not generated.

**Diagnosis**:

1. Verify that `SCHEDULER_ENABLED=true` on Agents.
2. Verify that the `SaasClient` can connect to the API (check `API_BASE_URL` and `JWT_SECRET`).
3. Review the Agents logs in Render.

---

## Quick links

| Resource             | URL                                                |
| -------------------- | -------------------------------------------------- |
| API in production    | `https://motoworkshop-api.onrender.com/api/health` |
| Web in production    | `https://motos-max-cordialidad.pages.dev`          |
| Render dashboard     | `https://dashboard.render.com`                     |
| Cloudflare dashboard | `https://dash.cloudflare.com`                      |
| Sentry               | `https://sentry.io`                                |
| Neon Console         | `https://console.neon.tech`                        |
| Meta Business        | `https://business.facebook.com`                    |
| Resend Dashboard     | `https://resend.com/dashboard`                     |

### Password-reset tokens piling up

**Symptom**: The `PasswordResetToken` table grows unbounded or users report that the email link does not work.

**Diagnosis**:

1. Check the API logs: look for `cleanup-expired-tokens: deleted N expired unused token(s)`.
2. The `CleanupExpiredTokensJob` runs every hour. If it does not appear in the logs, verify that `ScheduleModule.forRoot()` is active.

**Action**: The job deletes tokens where `expiresAt < NOW() AND usedAt IS NULL`. Used tokens are preserved for auditing.

---

## Password recovery — architecture and operation

### Technical flow

```
User -> POST /api/auth/forgot-password
      |
   [ForgotPasswordThrottlerGuard: 3 req/15min per IP+email]
      |
   ForgotPasswordUseCase:
     1. Look up user -> always responds HTTP 200 (anti-enumeration)
     2. deleteMany previous unused tokens (usedAt IS NULL)
     3. Create token: raw = randomBytes(32), hash = SHA-256(raw)
     4. Send email via Resend with the raw token

User -> POST /api/auth/reset-password (from the email link)
      |
   [ThrottlerGuard: 5 req/15min per IP]
      |
   ResetPasswordUseCase:
     1. hash = SHA-256(received token)
     2. findUnique(tokenHash) in DB
     3. Validate: exists + usedAt IS NULL + expiresAt > NOW()
        -> Any failure: HTTP 400 "Token inválido o expirado."
     4. transaction: update passwordHash + mark usedAt = NOW()
     5. Send confirmation email
```

### Rate limiting — configuration

| Type                                       | Limit           | File to adjust                                                                   |
| ------------------------------------------ | --------------- | -------------------------------------------------------------------------------- |
| Per IP+email (forgot-password)             | 3 req / 15 min  | `forgot-password-throttler.guard.ts` (dedicated guard, does not use `@Throttle`) |
| Per IP (reset-password)                    | 5 req / 15 min  | `auth.controller.ts` - `@Throttle` decorator on `resetPassword()`                |
| Per IP (login)                             | 5 req / 5 min   | `auth.controller.ts` - `@Throttle` decorator on `login()`                        |
| Per subject+route global - circuit breaker | 600 req / hour  | `app.module.ts` - throttler named `hourly`; client-derived ceiling, see ADR-012  |
| Per subject+route global - short window    | 60 req / minute | `app.module.ts` - throttler named `default`, key in `GlobalThrottlerGuard`       |

### Token cleanup job

| Parameter | Value                                             |
| --------- | ------------------------------------------------- |
| Frequency | `EVERY_HOUR` (`@nestjs/schedule`)                 |
| Condition | `expiresAt < NOW() AND usedAt IS NULL`            |
| Preserves | Tokens with `usedAt IS NOT NULL` (auditing)       |
| Class     | `CleanupExpiredTokensJob` in `identity.module.ts` |

### Password-recovery troubleshooting

**The email does not arrive**

1. Search the logs: `forgot-password: email sent to ...` or `SMTP FAILED for ...`.
2. Verify `RESEND_API_KEY` in the Render environment variables.
3. Verify `SMTP_FROM=onboarding@resend.dev` is configured.

**The link says the token is invalid or expired**

1. The token expires in 15 minutes. If the user waited longer, they must request a new one.
2. Only one valid token exists per user — only the last requested link works.

**Many users blocked by rate limit (429)**

1. The limit is 3 attempts / 15 min per IP+email (forgot-password) or 5 attempts / 15 min per IP (reset-password).
2. If it is a shared corporate proxy, raise the limit in `auth.controller.ts`.
3. Check Sentry for attack patterns.
