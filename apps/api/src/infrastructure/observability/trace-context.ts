import { AsyncLocalStorage } from 'node:async_hooks';

export interface TraceStore {
  traceId: string;
  tenantId?: string;
  userId?: string;
}

/** Propagates trace metadata to logs and Sentry without threading it manually. */
export const traceStorage = new AsyncLocalStorage<TraceStore>();

export function getTraceId(): string | undefined {
  return traceStorage.getStore()?.traceId;
}
