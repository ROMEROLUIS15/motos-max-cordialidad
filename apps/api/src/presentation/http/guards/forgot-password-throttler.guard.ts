import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { retryAfterMessage } from '../utils/retry-after-message';

/**
 * Self-contained rate-limiting guard for `POST /auth/forgot-password`.
 *
 * ## Why a custom guard instead of @Throttle?
 * NestJS `ThrottlerModule` applies ALL configured throttlers globally.
 * When `@Throttle()` overrides a named throttler, the global `APP_GUARD`
 * and the route-level guard BOTH check the same throttler config but with
 * different store keys (`IP:path` vs `IP:email`). This causes the effective
 * limit to be halved, blocking users after fewer attempts than configured.
 *
 * This guard is fully independent: it maintains its own in-memory Map and
 * is not affected by global ThrottlerModule configuration or `@Throttle()`
 * decorator interactions.
 *
 * ## Behavior
 * - Key: `IP + email` (case-insensitive, trimmed)
 * - Limit: 3 requests per 15-minute sliding window
 * - On block: throws HTTP 429 with a human-readable wait time in minutes
 * - Counter resets automatically when the TTL expires (next request after reset)
 *
 * ## Anti-enumeration
 * Because the key includes the email, each `(IP, email)` pair is throttled
 * independently. A different email from the same IP gets its own fresh counter.
 */
@Injectable()
export class ForgotPasswordThrottlerGuard implements CanActivate {
  private readonly store = new Map<string, { count: number; resetAt: number }>();

  /** Maximum requests allowed per window. */
  private readonly LIMIT = 3;

  /** Window size in milliseconds (15 minutes). */
  private readonly TTL_MS = 15 * 60 * 1000;

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    // E2E: skipped under NODE_ENV=test unless the test opts in with the
    // x-e2e-throttle header (mirrors the ThrottlerModule skipIf).
    if (process.env['NODE_ENV'] === 'test' && req.headers['x-e2e-throttle'] !== 'on') {
      return true;
    }

    const ip = req.ip ?? '0.0.0.0';
    const email =
      ((req.body as Record<string, unknown>)?.['email'] as string)?.toLowerCase().trim() ?? '';

    const key = `${ip}:${email}`;
    const now = Date.now();

    // Lazy prune: expired entries are otherwise never removed (only
    // overwritten on a repeat key), so the map would grow unbounded.
    if (this.store.size > 100) {
      for (const [k, v] of this.store) {
        if (v.resetAt <= now) this.store.delete(k);
      }
    }

    const entry = this.store.get(key);

    // Window expired or first request → fresh counter
    if (!entry || entry.resetAt <= now) {
      this.store.set(key, { count: 1, resetAt: now + this.TTL_MS });
      return true;
    }

    // Within window and limit exceeded → 429
    if (entry.count >= this.LIMIT) {
      const waitMin = Math.ceil((entry.resetAt - now) / 60_000);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          code: 'TOO_MANY_REQUESTS',
          message: retryAfterMessage(waitMin),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Within window and under limit → increment
    entry.count++;
    return true;
  }
}
