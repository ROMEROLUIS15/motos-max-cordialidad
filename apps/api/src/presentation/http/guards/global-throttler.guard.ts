import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

/**
 * Global rate-limiting guard.
 *
 * ## Key: identity + path
 * The standard `ThrottlerGuard` keys by IP alone, so every endpoint shares one
 * counter per IP: 60 hits on `/api/auth/login` would also block
 * `/api/auth/forgot-password`. Including the path gives each route its own
 * counter, which is what makes route-level `@Throttle()` overrides meaningful.
 *
 * ## Identity: the user when there is one, the IP when there isn't
 * A workshop's staff share one public IP (NAT), so an IP-keyed limit is really
 * a limit per *workshop*, and it tightens as the team grows. On authenticated
 * routes the caller already holds valid credentials, so the IP adds nothing:
 * the meaningful subject is the user. Unauthenticated routes (login,
 * forgot-password, webhooks) keep the IP, which is the only identity available
 * and the one that matters against brute force. `ForgotPasswordThrottlerGuard`
 * already applies the same reasoning with its `IP + email` key.
 *
 * The `sub` claim is read without verifying the signature: this guard runs as
 * `APP_GUARD`, before the route's `JwtAuthGuard`, so no verified user exists
 * yet. That is safe for a counter key — a forged `sub` still fails
 * authentication downstream and returns 401 with no data, so the only thing it
 * can shift is which bucket a doomed request is counted in. Unparseable or
 * absent tokens fall back to the IP.
 *
 * ## Registered as
 * `{ provide: APP_GUARD, useClass: GlobalThrottlerGuard }` in `app.module.ts`.
 */
@Injectable()
export class GlobalThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Request): Promise<string> {
    const subject = this.subjectOf(req);
    const path = req.path ?? '/';
    return `${subject}:${path}`;
  }

  private subjectOf(req: Request): string {
    const userId = this.userIdFromBearer(req.headers?.authorization);
    return userId ? `user:${userId}` : `ip:${req.ip ?? '0.0.0.0'}`;
  }

  /** Reads `sub` out of a bearer JWT payload. Never throws; never verifies. */
  private userIdFromBearer(authorization: string | undefined): string | null {
    if (!authorization?.startsWith('Bearer ')) return null;
    const payload = authorization.slice(7).split('.')[1];
    if (!payload) return null;
    try {
      const json = Buffer.from(payload, 'base64url').toString('utf8');
      const sub: unknown = (JSON.parse(json) as { sub?: unknown }).sub;
      return typeof sub === 'string' && sub.length > 0 ? sub : null;
    } catch {
      return null;
    }
  }
}
