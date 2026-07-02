---
name: '[Phase 2] Timing-Safe Token Comparison'
about: Upgrade password reset token validation to use timing-safe comparison
title: '[Phase 2] Implement timing-safe token comparison for password reset'
labels: security, phase-2, password-recovery
assignees: ''
---

## Context

Currently `ResetPasswordUseCase` looks up the token by its SHA-256 hash using
`findUnique({ where: { tokenHash: hash } })`. This DB lookup is not timing-safe —
the response time varies depending on whether the hash exists in the database,
which could theoretically allow timing attacks to enumerate valid token hashes.

## Proposed implementation

Replace the current SHA-256 lookup with a two-step approach:

1. Fetch the token record by a non-secret index (e.g., a short prefix stored separately).
2. Compare the full hash using `crypto.timingSafeEqual()`.

```ts
// Example approach
import { timingSafeEqual } from 'node:crypto';

const candidateHash = Buffer.from(createHash('sha256').update(token).digest('hex'));
const storedHash = Buffer.from(record.tokenHash);
const isValid =
  candidateHash.length === storedHash.length && timingSafeEqual(candidateHash, storedHash);
```

## Acceptance criteria

- [ ] Token comparison uses `crypto.timingSafeEqual()`
- [ ] Response time is statistically indistinguishable for valid/invalid tokens
- [ ] Existing E2E tests still pass
- [ ] Timing test in `password-recovery.e2e-spec.ts` (4.35-4.36) passes with TOLERANCE_MS < 100ms

## References

- OWASP: Timing Attacks — https://owasp.org/www-community/attacks/Timing_attack
- CWE-208: Observable Timing Discrepancy
