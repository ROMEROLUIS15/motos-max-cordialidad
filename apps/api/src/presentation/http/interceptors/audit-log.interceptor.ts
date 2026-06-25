import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { randomUUID } from 'node:crypto';
import { Request } from 'express';
import { JWTPayload } from '../../../application/ports/jwt.port';
import {
  AuditLogRepository,
  AUDIT_LOG_REPOSITORY,
} from '../../../domain/repositories/audit-log.repository';

const ACTION_BY_METHOD: Record<string, string> = {
  POST: 'CREATE',
  PUT: 'UPDATE',
  PATCH: 'UPDATE',
  DELETE: 'DELETE',
};

const SENSITIVE_KEYS = ['password', 'passwordhash', 'token', 'accesstoken', 'refreshtoken', 'whatsapptoken', 'secret'];

/**
 * Auto-audits mutating requests (POST/PUT/PATCH/DELETE). Captures sanitized
 * response data as new_data. Never blocks the response (.catch swallows errors).
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(@Inject(AUDIT_LOG_REPOSITORY) private readonly repo: AuditLogRepository) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { user?: JWTPayload; traceId?: string }>();
    const action = ACTION_BY_METHOD[req.method];
    const user = req.user;

    if (!action || !user) return next.handle();

    return next.handle().pipe(
      tap((body) => {
        const entityType = this.entityFromPath(req.path);
        const entityId = this.entityId(body, req.params);
        this.repo
          .create({
            id: randomUUID(),
            tenantId: user.tenantId,
            branchId: user.branchId,
            actorUserId: user.sub,
            entityType,
            entityId,
            action,
            previousData: null, // captured manually in critical UPDATE use cases (Fase 1)
            newData: this.sanitize(body),
            ipAddress: req.ip ?? null,
            traceId: req.traceId ?? null,
            createdAt: new Date(),
          })
          .catch(() => undefined);
      }),
    );
  }

  private entityFromPath(path: string): string {
    // /api/customers/:id → 'customers'
    const parts = path.split('/').filter(Boolean);
    const idx = parts[0] === 'api' ? 1 : 0;
    return parts[idx] ?? 'unknown';
  }

  private entityId(body: unknown, params: Record<string, string>): string {
    if (body && typeof body === 'object' && 'id' in body) return String((body as { id: unknown }).id);
    return params['id'] ?? params['workOrderId'] ?? 'n/a';
  }

  private sanitize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((v) => this.sanitize(v));
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = SENSITIVE_KEYS.includes(k.toLowerCase()) ? '[REDACTED]' : this.sanitize(v);
      }
      return out;
    }
    return value;
  }
}
