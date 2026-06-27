import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  PurchaseOrderDraftRepository,
  PurchaseOrderDraftRecord,
  PurchaseOrderDraftItem,
} from '../../../../domain/repositories/purchase-order-draft.repository';
import {
  Pagination,
  PaginatedResult,
  paginationToSkipTake,
} from '../../../../domain/shared/pagination';

type Row = {
  id: string;
  tenantId: string;
  status: string;
  items: unknown;
  notes: string | null;
  createdBy: string;
  approvedBy: string | null;
  approvedAt: Date | null;
  createdAt: Date;
};

@Injectable()
export class PurchaseOrderDraftPrismaRepository implements PurchaseOrderDraftRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(draft: PurchaseOrderDraftRecord): Promise<void> {
    await this.prisma.purchaseOrderDraft.create({
      data: {
        id: draft.id,
        tenantId: draft.tenantId,
        status: draft.status,
        items: draft.items as unknown as object,
        notes: draft.notes,
        createdBy: draft.createdBy,
        approvedBy: draft.approvedBy,
        approvedAt: draft.approvedAt,
        createdAt: draft.createdAt,
      },
    });
  }

  async list(
    tenantId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<PurchaseOrderDraftRecord>> {
    const { skip, take } = paginationToSkipTake(pagination);
    const [rows, total] = await Promise.all([
      this.prisma.purchaseOrderDraft.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.purchaseOrderDraft.count({ where: { tenantId } }),
    ]);
    return {
      items: rows.map((r) => this.toRecord(r)),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
    };
  }

  async updateStatus(
    id: string,
    tenantId: string,
    status: string,
    approvedBy: string,
  ): Promise<PurchaseOrderDraftRecord | null> {
    const existing = await this.prisma.purchaseOrderDraft.findFirst({ where: { id, tenantId } });
    if (!existing) return null;
    const r = await this.prisma.purchaseOrderDraft.update({
      where: { id },
      data: { status, approvedBy, approvedAt: new Date() },
    });
    return this.toRecord(r);
  }

  private toRecord(r: Row): PurchaseOrderDraftRecord {
    return {
      id: r.id,
      tenantId: r.tenantId,
      status: r.status,
      items: (r.items as PurchaseOrderDraftItem[]) ?? [],
      notes: r.notes,
      createdBy: r.createdBy,
      approvedBy: r.approvedBy,
      approvedAt: r.approvedAt,
      createdAt: r.createdAt,
    };
  }
}
