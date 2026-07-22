# Security Measures

**🌐 English** · [Español](./SECURITY.md)

---

## CORS

| Environment                               | Behavior                                                   |
| ----------------------------------------- | ---------------------------------------------------------- |
| Development (`NODE_ENV !== 'production'`) | `app.enableCors()` — open to all origins                   |
| Production                                | Restricted to `ALLOWED_ORIGINS` (env var, comma-separated) |

**Implementation**: `apps/api/src/main.ts:12-16`

---

## WebSocket CORS

Same logic as HTTP CORS. The WebSocket gateway (`NotificationsGateway`) reads `ALLOWED_ORIGINS` and sets `cors.origin` on the Socket.IO `Server`.

**Implementation**: `apps/api/src/infrastructure/notifications/notifications.gateway.ts`

---

## JWT (JSON Web Tokens)

| Measure               | Detail                                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Algorithm             | `HS256` (HMAC-SHA256)                                                                                                   |
| Secret                | `JWT_SECRET` — required in production (≥ 32 characters)                                                                 |
| Dev fallback          | If `NODE_ENV !== 'production'` and the var is missing, a default secret is used and a warning is logged (`Logger.warn`) |
| Access-token expiry   | Configurable via `JWT_EXPIRES_IN` (default `15m`)                                                                       |
| Refresh-token expiry  | Configurable via `JWT_REFRESH_EXPIRES_IN` (default `7d`)                                                                |
| Production validation | `TokenFactoryService` and `JwtService` throw an `Error` if the secret is not configured in production                   |
| Service-to-service    | Tokens with `type: "service"` and short expiry (`SERVICE_TOKEN_TTL_SECONDS`, default `300`)                             |

**Implementation**: `apps/api/src/infrastructure/auth/jwt.service.ts`, `apps/api/src/application/services/token-factory.service.ts`

---

## Sensitive-field encryption

| Property              | Value                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------- |
| Algorithm             | AES-256-GCM                                                                                   |
| Key size              | 256 bits (derived from `ENCRYPTION_KEY`, a 64-character hex string)                           |
| IV                    | 12 random bytes per encryption                                                                |
| Auth tag              | 16 bytes                                                                                      |
| Output                | Base64: `iv(12) + authTag(16) + ciphertext` concatenated                                      |
| Dev fallback          | If `NODE_ENV !== 'production'` and the key is missing, a fallback is used with `console.warn` |
| Production validation | `FieldEncryptionService` throws an `Error` if the key is missing                              |

**Implementation**: `apps/api/src/infrastructure/crypto/field-encryption.service.ts`

---

## Rate Limiting

| Scope                                 | Limit        | Window     | Key             | Implementation                                   |
| ------------------------------------- | ------------ | ---------- | --------------- | ------------------------------------------------ |
| Global (all routes)                   | 60 requests  | 1 minute   | subject + route | `GlobalThrottlerGuard` as `APP_GUARD`            |
| Global — containment circuit          | 600 requests | 1 hour     | subject + route | Second named throttler (`hourly`)                |
| `POST /api/auth/login`                | 5 requests   | 5 minutes  | IP              | `@Throttle()`                                    |
| `POST /api/auth/refresh`              | 10 requests  | 1 minute   | IP              | `@Throttle()`                                    |
| `POST /api/auth/forgot-password`      | 3 requests   | 15 minutes | IP + email      | `ForgotPasswordThrottlerGuard` (dedicated guard) |
| `POST /api/auth/reset-password`       | 5 requests   | 15 minutes | IP              | `@Throttle()`                                    |
| `POST /api/tenants` (workshop signup) | 3 requests   | 5 minutes  | IP              | `@Throttle()`                                    |

**Subject**: on authenticated routes it is the user (JWT `sub`); on anonymous routes, the IP. A workshop's users share the router's public IP, so a per-IP quota would be a per-workshop quota that tightens as the team grows. On an authenticated route the IP adds nothing — the caller already presented valid credentials — and the relevant subject is the person. On anonymous routes the IP is the only identity available and the one that matters against brute force; `ForgotPasswordThrottlerGuard` applies the same criterion with its `IP + email` key.

The `sub` is read from the JWT **without verifying the signature**: the global guard runs before the route-level `JwtAuthGuard`, so there is no verified user yet. This is safe for a counter key — a forged `sub` fails authentication downstream and returns `401` with no data, so the only thing it can alter is which bucket a request that will fail anyway is counted in. A missing or unreadable token falls back to the IP.

**The route is part of the key**, so a spike on one endpoint does not consume the others' quota and per-route `@Throttle()` overrides are independent of each other.

**The global ceilings are derived from the client, not chosen by eye.** The frontend refreshes several screens on a timer (`usePolling`), which produces constant background traffic while the app is open: a ceiling below that rate would throttle normal use, and would do so silently — a background refresh that receives `429` shows no error, it just stops updating. `rate-limit.policy.ts` computes the hourly ceiling as `(3,600,000 / interval) × headroom` and `rate-limit.policy.spec.ts` reads the real intervals from `apps/web` and fails if any of them approaches the limit. See ADR-012.

**Implementation**: `apps/api/src/presentation/http/guards/global-throttler.guard.ts`, `apps/api/src/presentation/http/rate-limit.policy.ts`, `apps/api/src/presentation/http/guards/forgot-password-throttler.guard.ts`, `apps/api/src/presentation/http/controllers/auth.controller.ts`, `apps/api/src/presentation/http/controllers/tenants.controller.ts`

---

## Account-enumeration protection

Login and the password-recovery flow are designed so that an error message never reveals whether an account exists:

| Endpoint                         | Behavior                                                                                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/login`           | Invalid credentials, a non-existent user and an inactive account all return the same generic message. Account status is evaluated **after** verifying the password. |
| `POST /api/auth/forgot-password` | Always responds `200` with the same message, whether or not the email is registered.                                                                                |
| `POST /api/auth/reset-password`  | A non-existent, already-used or expired token all return the same `400 "Token inválido o expirado."`.                                                               |

**Implementation**: `apps/api/src/application/use-cases/identity/authenticate-user.use-case.ts`, `forgot-password.use-case.ts`, `reset-password.use-case.ts`

---

## Multi-tenant isolation

Every resource (customers, vehicles, orders, users, inventory) is scoped by `tenantId`. The invariant rule: a write operation's `tenantId` is **always** resolved from the authenticated JWT, never from a request-body field. In the controller, the trusted fields (`tenantId`, route ids) are applied after spreading the body:

```typescript
// the body spread goes first — token-derived fields always win
await this.updateCustomer.execute({ ...body, customerId: id, tenantId: user.tenantId });
```

Verified with an end-to-end test against a real database (`apps/api/test/cross-tenant-write.e2e-spec.ts`): an authenticated user from one tenant cannot read or modify another tenant's resources, even if the request body tries to specify a different `tenantId`.

**Implementation**: controllers in `apps/api/src/presentation/http/controllers/`

---

## Signed-URL resources

| Resource                        | TTL        | Notes                                                                       |
| ------------------------------- | ---------- | --------------------------------------------------------------------------- |
| Financial report (web download) | 15 minutes | Private bucket; requires JWT + `reports:READ` permission to request the URL |
| Sales contract                  | 1 hour     | Generated on-demand only for confirmed sales                                |

A signed URL requires no further authentication once issued, so its lifetime is kept deliberately short.

**Implementation**: `apps/api/src/application/use-cases/agents/agents.use-cases/get-report-download-url.use-case.ts`, `apps/agents/src/reports/uploader.py`

---

## Webhook idempotency

The WhatsApp webhook deduplicates by `waMessageId` before processing an incoming message, because the provider (Meta) guarantees _at-least-once_ delivery — a network retry or a duplicate notification does not re-trigger the agent or generate a repeated reply to the customer.

**Implementation**: `apps/api/src/application/use-cases/messaging/process-incoming-message.use-case.ts`

---

## Input validation

`main.ts` registers a global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`. The API's `@Body()` payloads are typed as DTO classes decorated with `class-validator` (not TypeScript interfaces, which are erased at runtime and the pipe ignores) — an incorrect type or format responds `400` before reaching the use case, and `forbidNonWhitelisted` rejects the whole request if it carries a field the DTO does not declare. The authentication endpoints (login, signup, password recovery) additionally validate against a strict Zod schema ahead of the global pipe.

**Current coverage** (measured over the `@Body()` payloads in `presentation/http/controllers/`, 2026-07-16): **43 of 51 bodies validated** — 40 with a class DTO via the global pipe and 3 with an explicit Zod schema (`login`, `forgot-password`, `reset-password`, typed `unknown` on purpose so the schema is the only gate).

The remaining 8 have their `@Body()` typed with an `interface` or an inline type, so there is no class metadata at runtime and **the pipe lets them through unvalidated**: they accept unknown fields and incorrect types until the domain rejects them, if it does.

| Endpoint(s)                           | `@Body()` type                  | Exposure                                                      |
| ------------------------------------- | ------------------------------- | ------------------------------------------------------------- |
| `POST /api/sale-orders`               | `Omit<CreateSaleOrderInput, …>` | Authenticated (`sales:CREATE`)                                |
| `POST /api/sale-orders/:id/payments`  | inline object                   | Authenticated (`sales:UPDATE`)                                |
| `POST /api/receptions`                | `interface CreateReceptionBody` | Authenticated — part of order intake                          |
| 5 endpoints in `agents.controller.ts` | `interface *Body`               | Service-to-service (`ServiceAuthGuard`, JWT `type:"service"`) |

The business invariants are enforced in the domain (for example `SalePayment` rejects amounts ≤ 0 with `422`), and the `agents` ones are only reachable with a service token, not from the internet. Even so, there is no schema validation on any of the eight. Closing each gap means creating the equivalent class DTO; the test pattern that verifies it is in `update-tenant-config.dto.spec.ts`.

**Two rules follow from the above**, both verifiable:

1. **Every new DTO must be a `class` with decorators, never an interface or an inline type** — otherwise the pipe validates nothing and the endpoint is left open without any test noticing.
2. **A DTO must declare exactly what its client sends.** With `forbidNonWhitelisted`, a field the frontend sends and the DTO does not declare is not ignored: it takes down the whole request with `400`, dragging along the fields that were valid. The way to verify this is to feed the real `ValidationPipe` the frontend's literal payload; validating the class in isolation does not exercise that rule. Pattern: `update-tenant-config.dto.spec.ts`.

**Implementation**: `apps/api/src/main.ts`, `apps/api/src/presentation/http/dtos/*.dto.ts`

---

## Per-module access control (RBAC)

Each API module declares its permissions in `SYSTEM_ROLE_PERMISSIONS` (`domain/entities/role.entity.ts`), which the seed materializes as `role_permissions` rows, and each route requires its own with `@RequirePermission('module:ACTION')` + `PermissionGuard`.

**Both halves must exist, and they fail in opposite ways**:

- **A route without `@RequirePermission`**: the guard has nothing to resolve and **lets any authenticated user through**, even if the controller declares `PermissionGuard`. The guard declared without the decorator protects nothing.
- **A `@RequirePermission` for a module no role has**: the guard resolves the role's permissions against the DB, doesn't find the required one, and responds **`403` to everyone**. The route is not "protected": it is dead, even for the OWNER.

`rbac-policy.spec.ts` verifies the pairing: it walks the controllers' `@RequirePermission` decorators and fails if any of them asks for a permission no role holds.

**Permissions per sensitive module**:

| Module     | Who has it                   | Why                                                                                                                                                                                           |
| ---------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `settings` | OWNER, ADMIN (READ + UPDATE) | The workshop config carries the tax rate, the WhatsApp channel and the data printed on quotes and contracts. ADMIN already manages users and roles, more sensitive than the business address. |
| `audit`    | OWNER (READ)                 | The action trail for the whole team.                                                                                                                                                          |
| `messages` | OWNER, ADMIN, RECEPTIONIST   | Sending WhatsApp on the business's behalf.                                                                                                                                                    |

**Deployment gotcha**: adding a permission to `SYSTEM_ROLE_PERMISSIONS` does not apply it by itself to already-seeded roles. The seed runs at each container startup (`CMD`: `migrate deploy → seed → start`) and its `rolePermission.createMany({ skipDuplicates: true })` backfills the new permissions **before the app accepts traffic**, without duplicating the existing ones. Hence the mandatory order when protecting a new route: **first the permission in the matrix, and in the same deploy the `@RequirePermission`** — the other way around, the endpoint responds 403 to everyone until the permission arrives. The seed is best-effort (`|| echo 'seed skipped'`): if it failed, the app still starts and a route with a freshly added permission would return 403 until the next successful seed.

**Implementation**: `apps/api/src/domain/entities/role.entity.ts`, `apps/api/src/presentation/http/guards/permission.guard.ts`, `apps/api/src/domain/entities/rbac-policy.spec.ts`, `apps/api/prisma/seed.ts`

---

## Service-to-service authentication

Communication between NestJS (API) and Python (Agents) uses a JWT signed with the same `JWT_SECRET` key:

1. NestJS generates a token with `sub: "agents-service"`, `type: "service"` and a 5-minute TTL.
2. Python uses this token in the `Authorization: Bearer <token>` header for all calls to the API.
3. NestJS verifies the token and its type (`type === "service"`) via `ServiceAuthGuard`.
4. Python renews the token automatically before it expires (via `SaasClient.refresh_token_if_needed()`).
5. Validation is bidirectional: the agents microservice also requires and verifies the same token type on its own endpoints exposed to NestJS (`/agents/admin`), rejecting any call without a valid JWT signed with the shared `JWT_SECRET`.

**Implementation**: `apps/api/src/application/services/token-factory.service.ts`, `apps/api/src/presentation/http/guards/service-auth.guard.ts`, `apps/agents/src/saas_client.py`

---

## Order-number uniqueness

The human-readable order numbers (`WO-YYYY-NNNNNN` for work orders, and the equivalent for sale orders) are computed per tenant and year with a `SELECT COALESCE(MAX(...)) + 1`, instead of Redis counters or PostgreSQL sequences. Uniqueness does **not** rest on that query — which on its own is not concurrency-safe: two simultaneous requests would read the same `MAX` — but on the database constraint `@@unique([tenantId, orderNumber])`: if two requests compute the same number at once, the first inserts and the second is rejected by the constraint, so **a duplicate is never committed** (the losing request fails with a uniqueness violation and is retried).

**Implementation**: `apps/api/src/infrastructure/persistence/prisma/repositories/work-order.prisma-repository.ts` and `sale-order.prisma-repository.ts` (computation); `@@unique([tenantId, orderNumber])` in `apps/api/prisma/schema.prisma` (guarantee)

---

## Permission cache

The `PermissionGuard` caches the role's permissions in memory with a 30-second TTL (reduced from 5 minutes after an audit). In a multi-replica scenario, the short TTL minimizes the window of drift between a permission change and the guard reflecting it.

**Limitation**: The cache is in-memory (not Redis), so it is not shared across replicas. Each replica can drift by up to 30 seconds.

**Implementation**: `apps/api/src/presentation/http/guards/permission.guard.ts`

---

## Python — production config validation

In `apps/agents/src/config.py`, a Pydantic `model_validator` checks at startup that `JWT_SECRET` is not the default value when `NODE_ENV === "production"`. If it detects the default, it raises `ValueError` and the process does not start.

**Implementation**: `apps/agents/src/config.py`

---

## Summary of secrets required in production

| Variable                                    | Service     | Risk if missing                         |
| ------------------------------------------- | ----------- | --------------------------------------- |
| `JWT_SECRET`                                | API, Agents | Forgery of authentication tokens        |
| `ENCRYPTION_KEY`                            | API         | Sensitive data stored unencrypted       |
| `ALLOWED_ORIGINS`                           | API         | CORS open to any origin in production   |
| `WHATSAPP_ACCESS_TOKEN`                     | API         | WhatsApp messages cannot be sent        |
| `WHATSAPP_VERIFY_TOKEN`                     | API         | The WhatsApp webhook cannot be verified |
| `DEEPSEEK_API_KEY`                          | API, Agents | LLM agents non-functional               |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | API, Agents | No access to object storage             |
| `DATABASE_URL`                              | API, Agents | No database connection                  |

---

## Dependency vulnerabilities — accepted risk

`pnpm audit` and the secret scan (gitleaks) run on every push as part of the CI pipeline and block the merge on a new `high` vulnerability in production dependencies. The following are identified, evaluated and consciously accepted because their scope is build/development tooling, not code that runs in production:

| Package     | Severity      | Scope                                                               | Why accepted                                                        |
| ----------- | ------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `undici`    | High / medium | Transitive dependency of the Cloudflare Pages build tool (dev-only) | No compatible upgrade path (major jump); does not run in production |
| `esbuild`   | Medium        | Transitive dependency of the Cloudflare Pages build                 | Forcing the version blocks the build; risk confined to build time   |
| `file-type` | Medium        | Transitive dependency of NestJS 10                                  | Resolved by migrating to NestJS 11 (see ADR-007)                    |
| `webpack`   | Low           | Peer dependency of `@nestjs/cli`                                    | Idem — tied to the NestJS migration                                 |

These exceptions are declared explicitly in the monorepo's audit configuration (`package.json` → `pnpm.auditConfig`) and are reviewed on every dependency update.
