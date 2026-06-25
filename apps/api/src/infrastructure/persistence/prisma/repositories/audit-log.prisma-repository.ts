import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import {
  AuditLogRepository,
  AuditLogEntry,
  AuditLogFilters,
} from '../../../../domain/repositories/audit-log.repository';
import { Pagination, PaginatedResult, paginationToSkipTake } from '../../../../domain/shared/pagination';

@Injectable()
export class AuditLogPrismaRepository implements AuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(entry: AuditLogEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        id: entry.id,
        tenantId: entry.tenantId,
        branchId: entry.branchId,
        actorUserId: entry.actorUserId,
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        previousData: (entry.previousData ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        newData: (entry.newData ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        ipAddress: entry.ipAddress,
        traceId: entry.traceId,
        createdAt: entry.createdAt,
      },
    });
  }

  async query(
    tenantId: string,
    filters: AuditLogFilters,
    pagination: Pagination,
  ): Promise<PaginatedResult<AuditLogEntry>> {
    const where: Prisma.AuditLogWhereInput = { tenantId };
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.userId) where.actorUserId = filters.userId;
    if (filters.action) where.action = filters.action;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) (where.createdAt as Prisma.DateTimeFilter).gte = filters.from;
      if (filters.to) (where.createdAt as Prisma.DateTimeFilter).lte = filters.to;
    }
    const { skip, take } = paginationToSkipTake(pagination);
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.auditLog.count({ where }),
    ]);
    return {
      items: rows as unknown as AuditLogEntry[],
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
    };
  }
}
