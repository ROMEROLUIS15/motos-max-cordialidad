import * as Sentry from '@sentry/nestjs';
import { getTraceId, traceStorage } from './trace-context';

let enabled = false;

/** Initializes Sentry only when SENTRY_DSN is configured. No-op otherwise. */
export function initSentry(): void {
  const dsn = process.env['SENTRY_DSN'];
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'] ?? 'development',
    tracesSampleRate: 0.1,
  });
  enabled = true;
}

/** Captures an exception with the current trace/tenant/user context attached. */
export function captureException(error: unknown, extra?: Record<string, unknown>): void {
  if (!enabled) return;
  const store = traceStorage.getStore();
  Sentry.captureException(error, {
    tags: { trace_id: getTraceId(), tenant_id: store?.tenantId, user_id: store?.userId },
    extra,
  });
}
