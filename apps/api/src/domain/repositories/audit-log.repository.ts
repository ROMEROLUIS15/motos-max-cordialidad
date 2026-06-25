import { Pagination, PaginatedResult } from '../shared/pagination';

export interface AuditLogEntry {
  id: string;
  tenantId: string;
  branchId: string | null;
  actorUserId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  previousData: unknown | null;
  newData: unknown | null;
  ipAddress: string | null;
  traceId: string | null;
  createdAt: Date;
}

export interface AuditLogFilters {
  entityType?: string;
  entityId?: string;
  userId?: string;
  action?: string;
  from?: Date;
  to?: Date;
}

/** Append-only audit log: create + read. No update or delete by design. */
export interface AuditLogRepository {
  create(entry: AuditLogEntry): Promise<void>;
  query(
    tenantId: string,
    filters: AuditLogFilters,
    pagination: Pagination,
  ): Promise<PaginatedResult<AuditLogEntry>>;
}

export const AUDIT_LOG_REPOSITORY = Symbol('AuditLogRepository');
