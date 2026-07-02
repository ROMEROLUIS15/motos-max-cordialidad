## Why

The current password recovery flow has critical security vulnerabilities that allow account takeover without knowing the user's password. Timing attacks on token verification, error message disclosure, silent email failures, and lack of testing create an unacceptable security risk. This change implements immediate remediations to close OWASP A2/CWE-208/CWE-214 vulnerabilities and adds comprehensive E2E testing.

## What Changes

- **Error Messages**: Changed to generic "Token inválido o expirado" (no more "ya utilizado" or "expirado" distinctions)
- **Token Cleanup**: Automatically delete unused tokens before creating new ones (prevents multiple valid tokens per user)
- **Email Error Handling**: Errors now propagate to client instead of silently logging
- **Password Strength**: Validation now requires uppercase, lowercase, numbers (no more simple 8-char strings)
- **Rate Limiting**: Implement per-user/IP rate limits in addition to global limits
- **Timing-Safe Comparison**: Use `timingSafeEqual()` for token verification (Phase 2)
- **Token Cleanup Job**: Automatic expiration of tokens older than 15 minutes (maintenance)
- **E2E Tests**: Complete test coverage for forgot-password → reset-password → login flow
- **Cancel Email Link**: Users can cancel password resets they didn't request (Phase 2)

## Capabilities

### New Capabilities

- `password-recovery-security`: Core security fixes (error messages, token cleanup, email handling)
- `password-strength-validation`: Complexity validation for new passwords (uppercase, lowercase, numbers)
- `rate-limit-per-user`: Per-user/IP rate limiting for recovery endpoints
- `timing-safe-token-comparison`: Use crypto.timingSafeEqual() for token verification
- `password-token-cleanup-job`: Background job to clean expired tokens
- `password-recovery-test-suite`: Comprehensive E2E tests for entire recovery flow
- `password-recovery-cancel-link`: Allow users to cancel password reset requests

### Modified Capabilities

- `password-reset`: Token generation and validation (requirements change for timing-safe comparison)
- `forgot-password-endpoint`: Changes to error handling and token cleanup logic
- `reset-password-endpoint`: Unified error messages (non-goal: breaking change acceptable as security fix)

## Non-Goals

- Two-Factor Authentication (future enhancement)
- Password history tracking (future enhancement)
- Passwordless authentication alternatives (separate initiative)
- Admin oversight/cancellation of resets (future enhancement)
- Notification system redesign (out of scope for this change)

## Security & Rate Limiting

**Security Improvements**:

- Eliminate timing attacks via `timingSafeEqual()` comparison
- Remove information disclosure from error messages
- Prevent multiple simultaneous valid tokens per user
- Fail-fast email delivery errors

**Rate Limiting**:

- Current: 10 requests/hour global for both endpoints
- New: 5 requests/hour per (email + IP) combination for forgot-password
- New: Exponential backoff after 5 failed reset attempts (Phase 2)
- Maintain global limit of 100 requests/hour as safety valve

## Impact

**Affected Components**:

- `apps/api/src/application/use-cases/identity/forgot-password.use-case.ts`
- `apps/api/src/application/use-cases/identity/reset-password.use-case.ts`
- `apps/api/src/presentation/http/controllers/auth.controller.ts`
- `apps/api/src/infrastructure/mail/mail.service.ts`
- `apps/api/src/infrastructure/auth/password.service.ts`
- `apps/api/prisma/schema.prisma` (new: cancelTokenHash field, indices)
- `apps/api/test/password-recovery.e2e-spec.ts` (new file)

**Breaking Changes**:

- Error message format changes (may affect frontend error handling, but is a security fix)
- Password validation now requires complexity (users must use stronger passwords)

**Dependencies**:

- No new npm dependencies required
- Uses built-in Node.js `crypto` module (timingSafeEqual)
- Existing: bcryptjs, @nestjs/throttler

**Phase Breakdown**:

- **Phase 1 (Critical - This Week)**: Error messages, token cleanup, email handling, password validation, rate limiting, E2E tests (~3 hours)
- **Phase 2 (Important - Next Sprint)**: Timing-safe comparison, exponential backoff, cancel links (~2 hours)
- **Phase 3 (Enhancement - Later)**: Password history, 2FA, admin controls (~4+ hours)
