import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

/**
 * Global rate-limiting guard that keys by `IP:path` instead of IP alone.
 *
 * ## Why IP+path?
 * The standard `ThrottlerGuard` uses only the IP as the throttle key, which
 * means all endpoints share a single counter per IP. This causes cross-endpoint
 * contamination: hitting `/api/auth/login` 60 times would block requests to
 * `/api/auth/forgot-password` from the same IP, even if the per-route limit
 * has not been reached yet.
 *
 * By including the request path in the key, each route gets its own independent
 * counter per IP. This allows route-specific `@Throttle()` overrides to work
 * correctly without interfering with other routes.
 *
 * ## Registered as
 * `{ provide: APP_GUARD, useClass: GlobalThrottlerGuard }` in `app.module.ts`.
 */
@Injectable()
export class GlobalThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Request): Promise<string> {
    const ip = req.ip ?? '0.0.0.0';
    // Normalize path: remove query string, trailing slashes
    const path = req.path ?? '/';
    return `${ip}:${path}`;
  }
}
