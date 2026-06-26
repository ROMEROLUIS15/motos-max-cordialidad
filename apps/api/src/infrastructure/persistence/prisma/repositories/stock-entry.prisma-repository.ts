import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import {
  StockEntryRepository,
  StockEntryRecord,
  StockHistoryFilters,
  TopPartByRotation,
  PartConsumption,
} from '../../../../domain/repositories/stock-entry.repository';
import { StockEntryType } from '../../../../domain/value-objects/stock-entry-type.vo';
import {
  Pagination,
  PaginatedResult,
  paginationToSkipTake,
} from '../../../../domain/shared/pagination';

@Injectable()
export class StockEntryPrismaRepository implements StockEntryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(entry: StockEntryRecord): Promise<void> {
    await this.prisma.stockEntry.create({
      data: {
        id: entry.id,
        tenantId: entry.tenantId,
        partId: entry.partId,
        branchId: entry.branchId,
        type: entry.type,
        quantity: entry.quantity,
        userId: entry.userId,
        referenceId: entry.referenceId,
        notes: entry.notes,
        createdAt: entry.createdAt,
      },
    });
  }

  async history(
    filters: StockHistoryFilters,
    tenantId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<StockEntryRecord>> {
    const where: Prisma.StockEntryWhereInput = { tenantId };
    if (filters.partId) where.partId = filters.partId;
    if (filters.branchId) where.branchId = filters.branchId;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) (where.createdAt as Prisma.DateTimeFilter).gte = filters.from;
      if (filters.to) (where.createdAt as Prisma.DateTimeFilter).lte = filters.to;
    }
    const { skip, take } = paginationToSkipTake(pagination);
    const [rows, total] = await Promise.all([
      this.prisma.stockEntry.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.stockEntry.count({ where }),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        tenantId: r.tenantId,
        partId: r.partId,
        branchId: r.branchId,
        type: r.type as StockEntryType,
        quantity: Number(r.quantity),
        userId: r.userId,
        referenceId: r.referenceId,
        notes: r.notes,
        createdAt: r.createdAt,
      })),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
    };
  }

  async topPartsByRotation(
    branchId: string,
    tenantId: string,
    from: Date,
    to: Date,
    limit: number,
  ): Promise<TopPartByRotation[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{ partId: string; sku: string; name: string; totalQuantity: Prisma.Decimal }>
    >`
      SELECT se."partId" AS "partId", p."sku" AS "sku", p."name" AS "name",
             SUM(se."quantity") AS "totalQuantity"
      FROM "stock_entries" se
      JOIN "parts" p ON p."id" = se."partId"
      WHERE se."tenantId" = ${tenantId}
        AND se."branchId" = ${branchId}
        AND se."type" IN ('SALIDA', 'TRANSFER_OUT')
        AND se."createdAt" BETWEEN ${from} AND ${to}
      GROUP BY se."partId", p."sku", p."name"
      ORDER BY "totalQuantity" DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      partId: r.partId,
      sku: r.sku,
      name: r.name,
      totalQuantity: Number(r.totalQuantity),
    }));
  }

  async consumptionByPart(
    tenantId: string,
    from: Date,
    to: Date,
    branchId?: string,
  ): Promise<PartConsumption[]> {
    const branch = branchId ?? null;
    const rows = await this.prisma.$queryRaw<Array<{ partId: string; totalOut: Prisma.Decimal }>>`
      SELECT se."partId" AS "partId", SUM(se."quantity") AS "totalOut"
      FROM "stock_entries" se
      WHERE se."tenantId" = ${tenantId}
        AND (${branch}::text IS NULL OR se."branchId" = ${branch})
        AND se."type" = 'SALIDA'
        AND se."createdAt" BETWEEN ${from} AND ${to}
      GROUP BY se."partId"
    `;
    return rows.map((r) => ({ partId: r.partId, totalOut: Number(r.totalOut) }));
  }
}
