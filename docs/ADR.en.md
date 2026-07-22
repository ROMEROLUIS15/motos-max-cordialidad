# Architecture Decision Records

**🌐 English** · [Español](./ADR.md)

---

## ADR-001: pnpm Workspaces as the monorepo strategy

**Date**: 2024-10

**Context**: The project consists of multiple applications (NestJS API, Next.js Web, Python microservice) that share types and utilities. We need a way to manage dependencies, scripts and versions centrally.

**Decision**: Use pnpm workspaces with a single `pnpm-workspace.yaml` that groups `apps/*` and `packages/*`.

**Alternatives considered**:

| Alternative        | Reason for rejection                                                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **nx**             | Powerful but unnecessary configuration overhead for 3 apps. Nx brings its own cache, task orchestrator and generators that we don't need. |
| **turbo**          | Similar to nx. Remote cache is paid.                                                                                                      |
| **Separate repos** | Higher coordination overhead across repos (atomic changes, versioning of shared types).                                                   |
| **npm workspaces** | Basic support but no native overrides until npm 9+. pnpm has better handling of orphaned dependencies.                                    |

**Trade-offs**:

- **Positive**: Faster installs than npm (symlink + global store), overrides work to patch transitive deps, a unified `pnpm-lock.yaml` avoids version conflicts.
- **Negative**: pnpm is a separate ecosystem (not standard npm). Some tools (specifically the `@nestjs/cli` webpack plugin) can behave unexpectedly with pnpm's differential hoisting. On Windows, `bcrypt` needs `--ignore-scripts` due to its native compilation.

---

## ADR-002: Hexagonal architecture in NestJS

**Date**: 2024-10

**Context**: The API needs to be maintainable, testable and allow swapping infrastructure implementations (e.g. changing payment method, storage provider, ORM) without affecting business logic.

**Decision**: Split the code into 4 layers: Domain → Application → Infrastructure → Presentation.

```
Domain:         Entities + repositories (interfaces) + value objects. No external imports.
Application:    Use cases + ports (interfaces that Infrastructure implements). Depends only on Domain.
Infrastructure: Concrete implementations (PrismaService, JwtService, S3Storage, etc.). Depends on Application.
Presentation:   HTTP controllers, guards, filters, interceptors. Orchestrates use cases.
```

**Alternatives considered**:

| Alternative                    | Reason for rejection                                                                                                                                     |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Flat per-feature modules**   | Works for prototypes, but changing the ORM or storage provider means touching files across the codebase. Without DIP, tests use the real DB.             |
| **NestJS per-feature modules** | A NestJS feature-modular layout (e.g. `users/`, `workshop/`, `inventory/`) ends up mixing controllers with business logic and DB queries in one feature. |

**Trade-offs**:

- **Positive**: Real testability (you mock ports instead of the DB). Each layer can be replaced without touching the others. Business logic is portable to another framework.
- **Negative**: More files, more imports, more boilerplate (interfaces + implementations + module registrations). Learning curve for new developers.

---

## ADR-003: Symbol tokens for DI instead of interfaces

**Date**: 2024-10

**Context**: NestJS uses its own Dependency Injection system with decorators. We want to inject by interface to satisfy DIP, but TypeScript erases interfaces at compile time (no `instanceof` for interfaces at runtime). NestJS needs a concrete runtime token to resolve dependencies.

**Decision**: Use `Symbol('PortName')` as the DI token combined with `@Inject()`.

```typescript
// Port
export const WHATSAPP_SENDER_PORT = Symbol('WHATSAPP_SENDER_PORT');
export interface WhatsAppSenderPort {
  sendToPhone(to: string, message: string, sentBy: string | null): Promise<void>;
}

// Implementation
@Injectable()
export class WhatsAppCloudAdapter implements WhatsAppSenderPort { ... }

// Registration in the module
providers: [
  { provide: WHATSAPP_SENDER_PORT, useClass: WhatsAppCloudAdapter },
]

// Injection in the use case
constructor(
  @Inject(WHATSAPP_SENDER_PORT)
  private readonly whatsapp: WhatsAppSenderPort,
) {}
```

**Alternatives considered**:

| Alternative                     | Rejection                                                                                                                                                                                                             |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Injection by concrete class** | Breaks DIP: the use case depends on the implementation. If you swap providers, you touch the use case.                                                                                                                |
| **String token**                | `'WHATSAPP_SENDER_PORT'` works but risks string collisions and has no autocomplete. Symbol guarantees uniqueness.                                                                                                     |
| **abstract class**              | We could inject by `abstract class` (NestJS supports it). But it introduces inheritance where there should be interfaces. Also, an abstract class can carry implementation, which dilutes the separation of concerns. |

**Trade-offs**:

- **Positive**: Runtime-safe (TypeScript does not erase Symbols). Guaranteed uniqueness. Real DIP.
- **Negative**: More boilerplate (define the token, export it, register it explicitly in the module). Each new port requires touching 3 files (port, module, use case).

---

## ADR-004: Separate Python microservice for AI agents

**Date**: 2024-11

**Context**: We need conversational agents with LangGraph for WhatsApp and the admin dashboard. The team evaluates implementing them in TypeScript (same stack) or in a separate Python microservice.

**Decision**: Standalone Python microservice (`apps/agents/`) that communicates with NestJS via service-to-service JWT. Uses FastAPI + LangGraph + APScheduler + ReportLab.

**Alternatives considered**:

| Alternative                        | Reason for rejection                                                                                                                                                                      |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **LangChain.JS / Vercel AI SDK**   | The Python ecosystem for LLM tooling is more mature: official LangGraph, more models with native support, more agent tooling. TypeScript is catching up but still has fewer integrations. |
| **Integrate into NestJS directly** | Running LangGraph inside Node.js would require HTTP calls to an LLM proxy or Python bindings. More complex than a separate microservice.                                                  |
| **A single Python monolith**       | We'd lose all existing NestJS code (auth, Prisma, etc.). Migrating is not viable.                                                                                                         |

**Trade-offs**:

- **Positive**: Optimal stack for each task (NestJS for CRUD + auth, Python for LLM). LangGraph and LangChain in their natural environment. Schedulers (APScheduler) are more robust than the Node.js equivalents.
- **Negative**: More complex polyglot stack. Extra network latency (each tool call from the Python agent travels to NestJS and back). Operational cost of maintaining two stacks (build, deploy, monitoring).

---

## ADR-005: Cloudflare Pages + Render instead of Vercel + Railway

**Date**: 2024-10

**Context**: The project needs hosting for frontend and backend with no upfront cost. We evaluate serverless and container providers.

**Decision**: Frontend on Cloudflare Pages (free tier with unlimited bandwidth), backend on Render (own Dockerfile, free plan with 512 MB RAM).

**Alternatives considered**:

| Alternative | Reason for rejection                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------- |
| **Vercel**  | Excellent for frontend, but expensive for backend (serverless functions). No native Dockerfile support. |
| **Railway** | Good for backend but the free plan is limited to 500 MB and 500 hours. Frontend is not its strength.    |
| **Fly.io**  | More expensive than Render for the same service.                                                        |

**Trade-offs**:

- **Positive**: Cloudflare Pages global edge with unlimited bandwidth. Render supports a full Dockerfile (multistage build, automatic migrations). $0 cost on both for the free tier.
- **Negative**: Render's free tier has ~50-second cold starts (the container sleeps after inactivity). We mitigate with a keep-alive every 10 min via GitHub Action. Cloudflare Pages requires a manual Action for deploy (no native auto-deploy). Render's free plan has no DB replica (we use Neon separately).

---

## ADR-006: AES-256-GCM for encrypting sensitive DB fields

**Date**: 2024-10

**Context**: The system stores customers' personal data (names, phones, addresses) and financial data. Neon offers disk-level at-rest encryption, but we want an additional application-level layer of protection.

**Decision**: Use a `FieldEncryptionService` with AES-256-GCM (256-bit key, 12-byte IV, 16-byte auth tag). The key is derived from `ENCRYPTION_KEY` (64-character hex string).

```typescript
// encrypt: base64(iv + authTag + ciphertext)
// decrypt: reverse
```

**Alternatives considered**:

| Alternative                                         | Rejection                                                                                               |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Neon (disk) encryption only**                     | Protects against physical disk theft but not against a data leak from the app or a DB snapshot.         |
| **PostgreSQL column-level encryption (`pgcrypto`)** | Slower than encrypting in the app. The key would live in the DB (whoever accesses the DB gets the key). |
| **Encrypt nothing**                                 | Risk of exposing personal data.                                                                         |

**Trade-offs**:

- **Positive**: Double encryption layer (app + disk). The key is never in the DB. If someone gets a DB dump, the sensitive fields are unreadable.
- **Negative**: You cannot run `WHERE` over encrypted fields (they are non-deterministic). You must decrypt in the app before use. If `ENCRYPTION_KEY` is lost, the data is unrecoverable (no backdoor). Performance impact from encryption/decryption CPU on every read/write.

---

## ADR-007: NestJS stays on v10 — v11 migration deferred

**Date**: 2026

**Context**: NestJS 11 fixes a moderate-severity vulnerability in a transitive dependency (`file-type`, via `@nestjs/common`), but introduces breaking changes: Express v4→v5 and `@nestjs/schedule` v4→v6 with breaking changes in the cron-jobs API.

**Decision**: Stay on NestJS 10 until a planned migration with a dedicated testing window is executed. The vulnerability is accepted as a documented known risk (see `SECURITY.md`) in the meantime.

**Alternatives considered**:

| Alternative                              | Reason for rejection                                                                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Upgrade to v11 immediately**           | Breaking changes in Express and the scheduler without a dedicated testing window — risk of an unplanned regression in a system with active users. |
| **Patch only the transitive dependency** | Not possible: `file-type` is pinned by range in `@nestjs/common` 10.x; it requires the full major jump.                                           |

**Trade-offs**:

- **Positive**: Zero risk of an unplanned regression while the system is in active operation; the migration can be planned calmly instead of under CVE pressure.
- **Negative**: The vulnerability stays open (mitigated — build/transitive-dependency scope, not directly exploitable) until the migration runs. This ADR must be revisited when the v11 jump is planned.

---

## ADR-008: bcryptjs instead of bcrypt for password hashing

**Date**: 2026

**Context**: `bcrypt` (native binding) transitively depends on `@mapbox/node-pre-gyp` → `tar@^6`, a version with a known vulnerability. pnpm cannot force an override across incompatible majors (`tar@^6` → `>=7`) when the consumer declares that range.

**Decision**: Replace `bcrypt` with `bcryptjs`, a pure-JavaScript implementation with the same public API.

**Alternatives considered**:

| Alternative                                   | Reason for rejection                                                                                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Keep bcrypt and accept the transitive CVE** | An alternative existed without that cost; no reason to accept the risk.                                                                                 |
| **Argon2**                                    | Also requires a native binding, with the same portability and compilation problem across environments (Windows without build tools, Alpine containers). |

**Trade-offs**:

- **Positive**: No native dependencies — installs the same on any platform without build tools or compilation, eliminates the transitive CVE entirely.
- **Negative**: bcryptjs is slower than bcrypt's C implementation (a difference not perceptible at the system's current authentication volume).

---

## ADR-009: Email uniqueness per tenant, not global

**Date**: 2026

**Context**: The system is multi-tenant. The same person (e.g. an accountant or a regional manager) may need an account in more than one client workshop, potentially with the same email.

**Decision**: `email` uniqueness in the `User` model is defined at the tenant level (`@@unique([tenantId, email])`), not globally.

**Alternatives considered**:

| Alternative                 | Reason for rejection                                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Global email uniqueness** | Would prevent the same person from having accounts in two different workshops — a real business use case. |

**Trade-offs**:

- **Positive**: Models the business reality correctly; each tenant manages its own user space without coordinating with other tenants.
- **Negative**: Any authentication flow that does not receive the `tenantId` explicitly must resolve the possible cross-tenant ambiguity deterministically (implemented: login without `tenantId` proceeds only if exactly one account matches the email; otherwise it returns the same generic error as an invalid credential).

---

## ADR-010: `SalePayment` as a model independent of `Payment`

**Date**: 2026 (Phase 3 — sales module)

**Context**: The existing `Payment` model is designed specifically for payments tied to a work order (`workOrderId` required, coupled to the workshop's financial reports). The new motorcycle-sales module needs to record payments and installments for a sale.

**Decision**: Introduce `SalePayment` as an independent model instead of generalizing `Payment` with a polymorphic relation.

**Alternatives considered**:

| Alternative                                                  | Reason for rejection                                                                                                                                                                         |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Generalize `Payment` (polymorphic workOrder / saleOrder)** | Would have required migrating existing production data and complicating the workshop's financial-report queries, for a benefit (less model duplication) not critical within Phase 3's scope. |

**Trade-offs**:

- **Positive**: Ship the sales module with no migration risk over existing production data; each model stays simple and single-purpose.
- **Negative**: The "record payment" and "list payments" logic is duplicated across the two models. A candidate for unification if a third payment need appears (e.g. platform subscriptions).

---

## ADR-011: Domain repositories instead of `PrismaService` directly in use cases

**Date**: 2026-07-03 (general audit — High finding)

**Context**: An audit found 9 application-layer use-cases/services (`forgot-password`, `reset-password`, `cleanup-expired-tokens`, `work-order-parts`, `delivery-alerts` scheduler, `quote-assembler`, `transfer-vehicle-ownership`, `get-vehicle-history`, `get-customer-profile`) that injected `PrismaService` directly instead of a domain repository, violating the DIP of the hexagonal pattern already established in ADR-002: the application layer was coupled to the concrete ORM, not to an abstraction.

**Decision**: Create the missing domain repositories (`PasswordResetTokenRepository`, `VehicleOwnershipHistoryRepository`) and extend `WorkOrderRepository` with the missing query methods (`findVehicleServiceHistory`, `findRecentByCustomer`), migrating the 9 use cases to depend on those interfaces via Symbol token + `@Inject` (see ADR-003), never on `PrismaService`.

**Alternatives considered**:

| Alternative                                           | Reason for rejection                                                                                                                                       |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Leave it, document as tech debt**                   | The hexagonal pattern loses its purpose (testing use cases without a real DB) if a relevant part of the code bypasses it; further erosion in every new PR. |
| **A single "god repository" with all ad-hoc methods** | Repeats the original problem (coupling to Prisma) one level up; makes it harder to reason about which domain invariants each repository protects.          |

**Non-trivial trade-off found during implementation**: the NestJS import chain `WorkshopModule → VehiclesModule → CustomersModule` is circular in the reverse direction — `CommerceModule`/`VehiclesModule`/`CustomersModule` cannot import the canonical module that provides `WORK_ORDER_REPOSITORY`/`VEHICLE_REPOSITORY`/`CUSTOMER_REPOSITORY` without creating a cycle. We chose to locally re-provide the same token + implementation class in each module that needs it (documented inline) instead of introducing `forwardRef()`, which hides the real cycle rather than resolving it.

**Trade-offs**:

- **Positive**: all application-layer use cases are testable with pure mocks, without a real `PrismaClient` or a DB container; consistent with the rest of the code.
- **Negative**: the local re-provision of the same token in several modules is a minor duplication (a repeated `providers: [{ provide: TOKEN, useClass: Impl }]`) that must be kept in sync if the implementation class changes.

---

## ADR-012: Rate limiting by caller identity and client-derived ceilings

**Date**: 2026-07-16

**Context**: The global throttler protects the whole API. Its key was the caller's IP (plus the route, an ADR implicit in `GlobalThrottlerGuard`) and its ceilings were round numbers (60/minute, 100/hour). Two properties of the real system make that combination fail to describe a legitimate user:

1. **A workshop's users share a public IP** (they exit through the same router). A per-IP quota is, in practice, a per-workshop quota: it tightens as the team grows, punishing the customer for hiring people. The project had already recognized this effect in `ForgotPasswordThrottlerGuard`, which uses `IP + email` precisely so as not to block every user behind a NAT.
2. **The web client itself generates background traffic**: `usePolling` refreshes the notification bell and three screens every 30s. That's 120 requests/hour per screen with the tab simply open — above the 100/hour ceiling.

The second point is the costliest to diagnose: a background refresh that receives `429` produces no visible signal. There is no error screen; there is a counter that stops moving.

**Decision**:

- **The throttler key is the subject, not the machine**: on authenticated routes it is keyed by the JWT `sub`; on anonymous routes (login, forgot-password, webhooks) the IP is kept, which is the only identity available and the one that matters against brute force. The route remains part of the key.
- **Ceilings are derived from client behavior, not from round numbers**: `rate-limit.policy.ts` computes the hourly limit as `(3,600,000 / polling_interval) × headroom`, and `rate-limit.policy.spec.ts` reads the real intervals from `apps/web` and fails if any of them approaches the ceiling.

**Alternatives considered**:

| Alternative                                     | Reason for rejection                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Raise only the hourly ceiling**               | Fixes today's symptom and leaves the NAT multiplier intact: the correct number would then depend on how many employees the workshop has, and would break again on the next hire.                                                                                                                                     |
| **Lower the polling frequency**                 | Degrades the product (slower notifications) without addressing the cause: with 4 users behind one IP, any reasonable interval crosses a per-IP ceiling again.                                                                                                                                                        |
| **Replace polling with the existing WebSocket** | Eliminates the whole class of problem and is the natural destination (see "Evolution"), but today the services run on Render's free plan, which **suspends the process on inactivity**: connections would drop and reconnect constantly. In that environment polling is more robust than the WebSocket.              |
| **Verify the JWT inside the guard**             | The global guard runs before `JwtAuthGuard`, so it would have to duplicate signature verification on every request. For a counter key it adds nothing: a forged `sub` fails authentication downstream and returns 401 with no data, so the only thing it could alter is which bucket a doomed request is counted in. |

**Trade-offs**:

- **Positive**: the limit stops depending on the client's network topology; the team can grow without recalibrating anything. The ceilings are auditable: they read as a formula with its origin, not as an inherited constant.
- **Positive**: the coupling between the client interval and the server ceiling goes from invisible to verified in CI, with the name of the offending file in the failure message.
- **Negative**: the guard decodes the JWT (without verifying the signature) on every authenticated request — a `JSON.parse` over a base64 segment, negligible next to the query that follows, but work that was not done before.
- **Negative**: the invariant test reads `apps/web` sources with regular expressions, and fails if a refactor changes the shape of the calls. This is deliberate: the alternative — a shared constant both packages import — would only prove that the two files agree **with the constant**; a screen that hardcodes its interval would drift silently and the test would still be green. What must be verified is the number the client actually publishes. That the test breaks on a refactor is the price, and it warns exactly when the invariant is worth reviewing by hand.

**Evolution**: when the services move to a plan with a permanent process, the client can consume the WebSocket gateway the API already exposes (`notifications.gateway.ts`) and drop the polling. At that point the background traffic disappears and these ceilings stop having any relation to normal usage.

---

## ADR-013: Transactional, row-locked inventory mutations

**Date**: 2026-07-21

**Context**: The `InventoryAdapter` (the `InventoryPort` implementation) mutated stock with a read-modify-write pattern over absolute values and without a transaction:

1. `reserveStock` / `releaseReservation` read the row (`ensureExists`/`findByPartAndBranch`), applied the rule in the domain model, and saved `stockReservado` with `update`. Two concurrent reservations of the same part read the same `stockDisponible`, both pass `PartBranchStock.reserve()` validation, and the second `save` overwrites the first — a lost update that **oversells stock**.
2. `confirmStockDiscount` / `releaseAllReservations` iterated over an order's parts in a loop, each iteration with independent writes (`stock.save` + `stockEntry.create`), without a transaction. A mid-loop failure leaves stock **half-discounted** and the movement ledger (`StockEntry`) inconsistent with the physical count.

The repository already had the correct pattern in `transferAtomically` (`$transaction` + atomic operators), so the gap was one of **consistency**, not of knowledge: the equally critical reserve and discount operations did not follow it.

**Decision**: every stock mutation runs inside `prisma.$transaction` and locks the affected `part_branch_stock` row(s) with `SELECT … FOR UPDATE` before the read-modify-write. The row lock serializes concurrent callers on the same part, eliminating the lost update. Multi-part operations (`confirmStockDiscount`, `releaseAllReservations`) lock and write every part — and its `StockEntry` ledger rows — within **a single** transaction, so a failure rolls back the whole change. The business invariants stay in `PartBranchStock` (which throws `InsufficientStockException` / `INSUFFICIENT_PHYSICAL_STOCK`); the adapter only provides the transactional boundary.

**Alternatives considered**:

| Alternative                                                                                                              | Reason for rejection                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Atomic conditional `UPDATE`** (`SET reserved = reserved + q WHERE (physical - reserved) >= q`, checking affected rows) | Race-free without an explicit lock, but it moves the "don't reserve more than available" invariant into SQL, **abandoning the rich domain model** the rest of the project upholds (ADR-002). We preferred to keep the rule in `PartBranchStock` and give it atomicity via the lock. |
| **`Serializable` isolation + retry**                                                                                     | Preserves the domain model, but aborts with a serialization error under contention and forces a retry loop on every operation. `FOR UPDATE` (a pessimistic lock over a very narrow row) gives the same guarantee without the retry complexity.                                      |
| **Optimistic concurrency with a `version` column**                                                                       | Requires a schema migration and, again, retry logic on the client for the same result. More change surface for the same guarantee the row lock already provides.                                                                                                                    |
| **Leave it as-is and document as debt**                                                                                  | Overselling is a real correctness bug in a live flow (work orders + inventory), not a theoretical risk; the fix cost was low and the reference pattern already existed in the same file.                                                                                            |

**Non-trivial trade-off — a conscious deviation from ADR-011**: these atomic operations use Prisma's transaction client (`tx.partBranchStock.update`, `tx.stockEntry.create`, `tx.$queryRaw` for the `FOR UPDATE`) **directly**, instead of delegating to the domain repositories (`PartStockRepository`/`StockEntryRepository`) as ADR-011 mandates. This is deliberate: a transaction cannot be composed from independent repository calls without threading the `tx` through the ports' signatures, which would leak the persistence detail into the domain. The infrastructure adapter is the legitimate place for the "transactional script" — just as `transferAtomically` already lived in the repository — and it still depends only on `PrismaService`, not on another port.

**Trade-offs**:

- **Positive**: concurrency overselling and partial discounts disappear; physical stock and the movement ledger stay consistent (all-or-nothing).
- **Positive**: internal consistency — `transferAtomically`'s atomic pattern now applies to every stock mutation, not just one.
- **Negative**: `FOR UPDATE` holds a row lock for the (short) transaction; concurrent reservations of the **same** part serialize. This is the correct behavior, but it reduces parallelism at that point.
- **Negative**: the lock requires `$queryRaw` because Prisma does not expose `FOR UPDATE` in its fluent API; it is parameterized raw SQL, scoped to a single-PK read.

**Verification**: `inventory.adapter.spec.ts` covers the orchestration (the lock is taken before writing, the domain rejects the insufficient case without persisting, the multi-part loop runs in one transaction). The real `FOR UPDATE` serialization and the all-or-nothing rollback are Postgres guarantees, exercised against a real database in `test/workshop-flow.e2e-spec.ts`.
