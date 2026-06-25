import { Part } from '../entities/part.entity';
import { Pagination, PaginatedResult } from '../shared/pagination';

export interface PartSearchFilters {
  query?: string;
  category?: string;
}

export interface PartWithStock {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  salePrice: number;
  costPrice: number;
  minStockAlert: number | null;
  isActive: boolean;
  stockFisico: number;
  stockReservado: number;
  stockDisponible: number;
  lowStock: boolean;
}

export interface PartRepository {
  findById(id: string, tenantId: string): Promise<Part | null>;
  findBySku(sku: string, tenantId: string): Promise<Part | null>;
  search(filters: PartSearchFilters, tenantId: string, pagination: Pagination): Promise<PaginatedResult<Part>>;
  searchWithStock(
    filters: PartSearchFilters,
    tenantId: string,
    branchId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<PartWithStock>>;
  create(part: Part): Promise<void>;
  save(part: Part): Promise<void>;
}

export const PART_REPOSITORY = Symbol('PartRepository');
