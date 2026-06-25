import { StockEntryType } from '../value-objects/stock-entry-type.vo';
import { Pagination, PaginatedResult } from '../shared/pagination';

export interface StockEntryRecord {
  id: string;
  tenantId: string;
  partId: string;
  branchId: string;
  type: StockEntryType;
  quantity: number;
  userId: string;
  referenceId: string | null;
  notes: string | null;
  createdAt: Date;
}

export interface StockHistoryFilters {
  partId?: string;
  branchId?: string;
  from?: Date;
  to?: Date;
}

export interface TopPartByRotation {
  partId: string;
  sku: string;
  name: string;
  totalQuantity: number;
}

export interface StockEntryRepository {
  create(entry: StockEntryRecord): Promise<void>;
  history(
    filters: StockHistoryFilters,
    tenantId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<StockEntryRecord>>;
  topPartsByRotation(
    branchId: string,
    tenantId: string,
    from: Date,
    to: Date,
    limit: number,
  ): Promise<TopPartByRotation[]>;
}

export const STOCK_ENTRY_REPOSITORY = Symbol('StockEntryRepository');
