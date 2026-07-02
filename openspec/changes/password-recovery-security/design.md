## Context

**Current State**: The password recovery flow (forgot-password → email → reset-password) has fundamental security gaps:

- No timing-safe token verification (CWE-208: Observable Timing Discrepancy)
- Error messages leak information about token state (CWE-214: Information Exposure)
- No cleanup of previous tokens (allows multiple simultaneous attempts)
- Email send failures silently logged, not reported to user
- Weak password validation (length only, no complexity)
- Global rate limiting only (no per-user granularity)
- Zero E2E test coverage

**Stakeholders**: All users of the app who need to reset passwords; security/compliance team; DevOps (for monitoring email failures).

**Constraints**:

- Must maintain backward compatibility in API signatures (errors can change)
- PostgreSQL/Neon database (use native features where possible)
- NestJS ecosystem (use @nestjs/throttler, Prisma, built-in modules)
- Cannot introduce new npm dependencies
- Security fixes are non-negotiable; breaking changes acceptable if documented

---

## Goals / Non-Goals

**Goals:**

- Eliminate timing attacks on token verification
- Remove information disclosure from error messages
- Prevent multiple simultaneous valid tokens per user
- Propagate email delivery errors to client
- Enforce password complexity (uppercase, lowercase, number minimum)
- Implement per-user rate limiting in addition to global
- Add comprehensive E2E test coverage (90%+ of scenarios)
- Enable future 2FA and cancellation features (architecture support)

**Non-Goals:**

- Two-Factor Authentication (separate change)
- Admin capabilities to cancel user resets (Phase 2+)
- Password history (Phase 3+)
- Passwordless auth alternatives (separate initiative)
- Frontend-side validation reimplementation (backend validation is source of truth)

---

## Decisions

### 1. Error Message Unification

**Decision**: Return `"Token inválido o expirado."` for all token validation failures (not used, expired, nonexistent).

**Rationale**:

- Prevents information disclosure (CWE-214)
- Attackers cannot distinguish token states
- UX impact: minimal (users don't debug tokens anyway)

**Alternatives Considered**:

- Include reason in debug logs only (chose this for implementation logs, but not in errors)
- Return 403 for used tokens, 400 for others (exposes timing information via HTTP status)
- Return different HTTP status codes (403 Forbidden vs 400 Bad Request) - rejected for same reason

**Implementation**: Single `if` statement at start of validation that combines all failure conditions.

---

### 2. Token Cleanup Before Creation

**Decision**: Delete all unused password reset tokens for a user before creating a new one.

**Rationale**:

- Reduces attack surface (only 1 valid token per user at a time)
- Prevents database pollution (no orphaned tokens)
- Aligns with principle of least privilege
- Simple implementation (one `deleteMany` query)

**Alternatives Considered**:

- Limit tokens per user (e.g., max 3 pending) - complexity: requires counting
- Automatic expiration only (via cleanup job) - allows accumulation, adds work to request
- Don't clean up (current state) - high risk

**Implementation**: Before `create()` call in forgot-password use-case, add `deleteMany()` with `userId` and `usedAt: null` filters.

---

### 3. Email Error Handling (Anti-Enumeration Safe)

**Decision**: Always return HTTP 200 with generic message to the client, regardless of email delivery outcome. Log errors internally and trigger ops alerts (Sentry/structured logging).

**Rationale**:

- Returning HTTP 500 on SMTP failure when email exists (vs 200 when it doesn't) would leak email existence — violating anti-enumeration protection
- Internal alerting ensures ops awareness without compromising security
- User can retry forgot-password; the old token is cleaned up, new one is created

**Alternatives Considered**:

- Throw `InternalServerErrorException` (rejected: creates info disclosure vector)
- Queue emails with retry (adds complexity, Redis dependency — possible Phase 2)
- Log and continue silently (current state, insufficient — no ops alerting)

**Implementation**: Keep try-catch-log pattern but add structured error logging with severity=ERROR and correlation ID for ops monitoring.

---

### 4. Password Strength Validation

**Decision**: Require password to match regex: `[A-Z]` AND `[a-z]` AND `[0-9]` AND `[^A-Za-z0-9]` (or simplified: first 3).

**Rationale**:

- NIST SP 800-63B compliant (complexity via character mix)
- Prevents dictionary attacks
- ~100x stronger than length-only validation

**Alternatives Considered**:

- Use entropy-based library (zxcvbn) - adds npm dependency, rejected
- Require only 3 of 4 character types - simpler, chosen implementation
- No complexity, allow users to choose (rejected as insecure)

**Implementation**: Zod schema with three `.regex()` validators (uppercase, lowercase, number minimum).

---

### 5. Per-User Rate Limiting

**Decision**: Implement custom throttler key generator to combine IP + email. Maintain global limit as safety valve.

**Rationale**:

- Prevents enumeration of valid emails via timing
- Per-user limits: 5 forgot-password per email/IP per hour
- Global limit: 100 total requests per hour (circuit breaker)
- Uses existing @nestjs/throttler infrastructure

**Alternatives Considered**:

- Implement custom interceptor (more control, but duplicates throttler work)
- Only per-IP (doesn't protect from enumeration across different attackers)
- Only per-email (doesn't protect user from distributed attacks)
- Time-based backoff (exponential, added later in Phase 2)

**Implementation**: Extend ThrottlerGuard, override `getTracker()` to return `${ip}:${email}` key.

---

### 6. Token Verification Method (Phase 1: SHA-256, Phase 2: Upgrade)

**Decision**: Phase 1 uses existing SHA-256 hashing (no changes). Phase 2 upgrades to `crypto.timingSafeEqual()`.

**Rationale**:

- Phase 1 focuses on error disclosure and cleanup (higher risk, easier fix)
- Timing-safe comparison requires careful testing (defer to Phase 2)
- Allows incremental security hardening
- Prevents breaking changes to Prisma model

**Alternatives Considered**:

- Use bcrypt for tokens (slower, ~250ms per verification, breaks existing tokens)
- Use crypto.timingSafeEqual() immediately (more complex, requires testing)
- Stay with SHA-256 (timing attack risk remains, but mitigated by other controls)

**Implementation (Phase 2)**: Import `timingSafeEqual`, use in comparison after `findUnique()`.

---

### 7. Cleanup Job Architecture

**Decision**: Use @nestjs/schedule decorator with `@Cron()` to run hourly cleanup job.

**Rationale**:

- No external job queue needed (Redis, etc.)
- Lightweight, built-in to NestJS
- Sufficient for hourly granularity
- Tracks in logs for monitoring

**Alternatives Considered**:

- Bull/BullMQ queue (adds Redis dependency, overkill for cleanup)
- Separate cron service (adds complexity, harder to test)
- Manual admin command (doesn't scale, requires human intervention)

**Implementation**: New `CleanupExpiredTokensJob` class with `@Cron(CronExpression.EVERY_HOUR)`.

---

### 8. E2E Testing Strategy

**Decision**: Create comprehensive test suite covering happy path, edge cases, error conditions, and rate limiting.

**Rationale**:

- Zero current coverage is unacceptable risk
- E2E tests validate integration across use-cases, controller, mail service
- Tests should be source of truth for behavior
- Prevent regressions in security fixes

**Alternatives Considered**:

- Unit tests only (doesn't test integration or email sending)
- Manual QA only (doesn't scale, human error prone)
- No tests (current state, unacceptable)

**Implementation**: New file `test/password-recovery.e2e-spec.ts` with ~10 test cases (see PASSWORD_RECOVERY_FIXES.md FIX #9).

---

## Risks / Trade-offs

| Risk                                             | Impact                               | Mitigation                                                                                              |
| ------------------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| **Password complexity frustration**              | Users forget more often              | Document requirements upfront; frontend can show strength meter                                         |
| **Email failures block users**                   | UX regression (users now see errors) | Add "Try again" button, link to support; consider queueing in Phase 2                                   |
| **Rate limit blocking legitimate users**         | Rare but possible                    | Set limit to 5/hour (generous for real users); add "Contact support" message                            |
| **One token per user breaks power-user testing** | Dev/QA friction                      | Manual deletion in tests or use `beforeEach` cleanup in test suite                                      |
| **Timing-safe delay in Phase 2**                 | Security window remains open         | Controls from Phase 1 (error unification, cleanup) significantly reduce risk; Phase 2 deadline: 2 weeks |
| **Silent rate limit hits**                       | User confusion if throttled          | Return 429 with clear message; not same as "invalid token"                                              |

---

## Migration Plan

### Deployment Steps

1. **Preparation (Day 0)**:

   - Merge Phase 1 code to staging
   - Run full E2E test suite
   - Manual testing of error flows
   - Verify no regressions on login/token refresh

2. **Staging (Day 1)**:

   - Deploy to staging environment
   - Run load tests (rate limiting, email queueing)
   - Run monitoring checks (Sentry, logs)
   - Smoke test: forgot-password → email → reset → login

3. **Production (Day 2)**:
   - Blue-green deployment (existing instances stay live)
   - Monitor error rates in Sentry (expect no increase)
   - Monitor email delivery metrics
   - Monitor rate limit hits (should be zero for normal users)
   - Keep rollback plan ready (revert to previous image)

### Rollback Plan

If critical issues arise:

1. Revert to previous container image (`docker run :previous-tag`)
2. No database rollback needed (schema not changing in Phase 1)
3. Old clients continue to work (errors are more generic, not breaking)
4. Estimate rollback time: <5 minutes (blue-green means no downtime)

### Testing Before Deployment

- [ ] E2E test suite passes (new test file)
- [ ] Manual test: forgot-password flow end-to-end
- [ ] Manual test: rate limiting (attempt >5 per hour)
- [ ] Manual test: weak password rejected (e.g., "12345678")
- [ ] Manual test: email send failure surfaces error
- [ ] Load test: 100 concurrent requests to endpoints
- [ ] Check Sentry for error spikes

---

## Open Questions

1. **Email queueing**: Should Phase 1 include email retry logic, or defer to Phase 2? (Current plan: Phase 2, immediately relaying errors for now)
2. **Exponential backoff timing**: After how many failed attempts should we throttle? (Current proposal: 5 attempts, 1 hour lockout)
3. **Cancel link UX**: Should we send two separate emails (one to confirm, one with cancel link)? (Current plan: One email with both actions)
4. **Password history**: Keep history in same `PasswordResetToken` table or separate? (Current plan: Separate table in Phase 3)
5. **Admin override**: Should admins be able to force-reset without email? (Current plan: Out of scope, evaluate in Phase 2)

---

## Implementation Phases

**Phase 1 (This Week, ~3 hours)**:

- Error message unification
- Token cleanup before creation
- Email error propagation
- Password strength validation
- Per-user rate limiting
- E2E test suite
- Deployment to production

**Phase 2 (Next Sprint, ~2 hours)**:

- Timing-safe comparison with `timingSafeEqual()`
- Exponential backoff on failed attempts
- Cancel email links
- Additional load testing

**Phase 3 (Future, ~4+ hours)**:

- Password history tracking
- Two-Factor Authentication
- Admin override capabilities
- Advanced monitoring and alerts
