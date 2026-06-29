import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  PurchaseOrderDraftRepository,
  PURCHASE_ORDER_DRAFT_REPOSITORY,
  PurchaseOrderDraftItem,
} from '../../../../domain/repositories/purchase-order-draft.repository';

export interface CreatePurchaseOrderDraftInput {
  tenantId: string;
  items: PurchaseOrderDraftItem[];
  notes?: string;
  createdBy: string;
}

@Injectable()
export class CreatePurchaseOrderDraftUseCase {
  constructor(
    @Inject(PURCHASE_ORDER_DRAFT_REPOSITORY)
    private readonly drafts: PurchaseOrderDraftRepository,
  ) {}

  async execute(input: CreatePurchaseOrderDraftInput) {
    const id = randomUUID();
    await this.drafts.create({
      id,
      tenantId: input.tenantId,
      status: 'DRAFT',
      items: input.items,
      notes: input.notes ?? null,
      createdBy: input.createdBy,
      approvedBy: null,
      approvedAt: null,
      createdAt: new Date(),
    });
    return { id, status: 'DRAFT' };
  }
}
