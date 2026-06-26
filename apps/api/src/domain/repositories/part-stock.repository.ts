import { PartBranchStock } from '../entities/part-branch-stock.entity';

export interface TransferStockInput {
  tenantId: string;
  partId: string;
  fromBranchId: string;
  toBranchId: string;
  quantity: number;
  userId: string;
  notes?: string;
}

export interface LowStockItem {
  partId: string;
  sku: string;
  name: string;
  branchId: string;
  stockDisponible: number;
  minStockAlert: number;
}

export interface PartStockRepository {
  findByPartAndBranch(partId: string, branchId: string): Promise<PartBranchStock | null>;
  save(stock: PartBranchStock): Promise<void>;
  /** Creates a zeroed stock row for a part+branch if it does not exist. */
  ensureExists(partId: string, branchId: string): Promise<PartBranchStock>;
  /** Full transfer in a single DB transaction (lives in infrastructure). */
  transferAtomically(input: TransferStockInput): Promise<void>;
  findLowStock(branchId: string, tenantId: string): Promise<LowStockItem[]>;
  /** Low-stock items tenant-wide (across branches), optionally scoped to one. */
  findLowStockByTenant(tenantId: string, branchId?: string): Promise<LowStockItem[]>;
  valuation(branchId: string, tenantId: string): Promise<{ totalCost: number; totalSale: number }>;
}

export const PART_STOCK_REPOSITORY = Symbol('PartStockRepository');
