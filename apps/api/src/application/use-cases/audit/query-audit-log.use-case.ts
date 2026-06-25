import { Inject, Injectable } from '@nestjs/common';
import {
  AuditLogRepository,
  AUDIT_LOG_REPOSITORY,
  AuditLogFilters,
  AuditLogEntry,
} from '../../../domain/repositories/audit-log.repository';
import { PaginatedResult } from '../../../domain/shared/pagination';

export interface QueryAuditLogInput extends AuditLogFilters {
  tenantId: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class QueryAuditLogUseCase {
  constructor(@Inject(AUDIT_LOG_REPOSITORY) private readonly repo: AuditLogRepository) {}

  async execute(input: QueryAuditLogInput): Promise<PaginatedResult<AuditLogEntry>> {
    return this.repo.query(
      input.tenantId,
      {
        entityType: input.entityType,
        entityId: input.entityId,
        userId: input.userId,
        action: input.action,
        from: input.from,
        to: input.to,
      },
      { page: input.page ?? 1, pageSize: input.pageSize ?? 20 },
    );
  }
}
