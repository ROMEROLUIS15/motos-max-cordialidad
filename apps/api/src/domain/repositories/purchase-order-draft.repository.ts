export interface PurchaseOrderDraftItem {
  partId: string;
  quantity: number;
  reason?: string;
}

export interface PurchaseOrderDraftRecord {
  id: string;
  tenantId: string;
  status: string; // DRAFT | APPROVED | REJECTED
  items: PurchaseOrderDraftItem[];
  notes: string | null;
  createdBy: string;
  approvedBy: string | null;
  approvedAt: Date | null;
  createdAt: Date;
}

import { Pagination, PaginatedResult } from '../shared/pagination';

export interface PurchaseOrderDraftRepository {
  create(draft: PurchaseOrderDraftRecord): Promise<void>;
  list(
    tenantId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<PurchaseOrderDraftRecord>>;
  updateStatus(
    id: string,
    tenantId: string,
    status: string,
    approvedBy: string,
  ): Promise<PurchaseOrderDraftRecord | null>;
}

export const PURCHASE_ORDER_DRAFT_REPOSITORY = Symbol('PurchaseOrderDraftRepository');
