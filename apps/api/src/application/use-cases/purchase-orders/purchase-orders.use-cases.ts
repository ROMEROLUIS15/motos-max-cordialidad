import { Inject, Injectable } from '@nestjs/common';
import {
  PurchaseOrderDraftRepository,
  PURCHASE_ORDER_DRAFT_REPOSITORY,
} from '../../../domain/repositories/purchase-order-draft.repository';
import { Pagination } from '../../../domain/shared/pagination';
import { DomainException } from '../../../domain/exceptions/domain.exception';

@Injectable()
export class ListPurchaseOrderDraftsUseCase {
  constructor(
    @Inject(PURCHASE_ORDER_DRAFT_REPOSITORY)
    private readonly repo: PurchaseOrderDraftRepository,
  ) {}

  async execute(tenantId: string, pagination: Pagination) {
    return this.repo.list(tenantId, pagination);
  }
}

@Injectable()
export class DecidePurchaseOrderDraftUseCase {
  constructor(
    @Inject(PURCHASE_ORDER_DRAFT_REPOSITORY)
    private readonly repo: PurchaseOrderDraftRepository,
  ) {}

  /** status must be APPROVED or REJECTED. Returns null if the draft is absent. */
  async execute(id: string, tenantId: string, status: 'APPROVED' | 'REJECTED', approvedBy: string) {
    if (status !== 'APPROVED' && status !== 'REJECTED') {
      throw new DomainException(`Invalid decision: ${status}`, 'PURCHASE_ORDER_INVALID_DECISION');
    }
    return this.repo.updateStatus(id, tenantId, status, approvedBy);
  }
}
