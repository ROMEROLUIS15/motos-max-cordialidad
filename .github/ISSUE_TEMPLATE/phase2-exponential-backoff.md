---
name: '[Phase 2] Exponential Backoff on Rate Limits'
about: Replace fixed 1-hour rate limit window with exponential backoff for repeated offenders
title: '[Phase 2] Implement exponential backoff on forgot-password rate limiting'
labels: security, phase-2, password-recovery
assignees: ''
---

## Context

The current rate limiter (`AdvancedThrottlerGuard`) applies a fixed 5 req/hour window
per IP+email. A sophisticated attacker can simply wait exactly 1 hour and repeat.
Exponential backoff increases the penalty for repeated offenses, making automated
attacks exponentially more expensive.

## Proposed implementation

Track per-IP+email violation counts in Redis and compute TTL dynamically:

| Offense # | Backoff  |
| --------- | -------- |
| 1st block | 1 hour   |
| 2nd block | 2 hours  |
| 3rd block | 4 hours  |
| 4th+      | 24 hours |

```ts
// Pseudocode
const key = `backoff:${ip}:${email}`;
const offenseCount = await redis.incr(key);
const ttl = Math.min(3600 * 2 ** (offenseCount - 1), 86400); // cap at 24h
await redis.expire(key, ttl * 2); // keep the counter twice as long
```

## Acceptance criteria

- [ ] First violation: 1-hour block (same as current)
- [ ] Second violation: 2-hour block
- [ ] Third violation: 4-hour block
- [ ] Fourth+ violation: 24-hour block
- [ ] Block counter resets after 48 hours of no violations
- [ ] E2E tests updated to verify escalating blocks
- [ ] `Retry-After` header reflects the actual backoff window

## Dependencies

- Requires Redis (already available via `REDIS_URL`)
- Requires storing violation count separate from the throttler counter

## References

- NIST SP 800-63B §5.2.2 — Rate limiting guidance
