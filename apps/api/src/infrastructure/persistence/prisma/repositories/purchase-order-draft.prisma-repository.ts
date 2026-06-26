import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  PurchaseOrderDraftRepository,
  PurchaseOrderDraftRecord,
} from '../../../../domain/repositories/purchase-order-draft.repository';

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
}
