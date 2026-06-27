import { MotorcycleUnit } from '../entities/motorcycle-unit.entity';
import { Pagination, PaginatedResult } from '../shared/pagination';

export interface MotorcycleUnitSearchFilters {
  query?: string;
  status?: string;
  condition?: string;
  branchId?: string;
}

export interface MotorcycleUnitRepository {
  findById(id: string, tenantId: string): Promise<MotorcycleUnit | null>;
  findByVin(vin: string, tenantId: string): Promise<MotorcycleUnit | null>;
  search(
    filters: MotorcycleUnitSearchFilters,
    tenantId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<MotorcycleUnit>>;
  create(unit: MotorcycleUnit): Promise<void>;
  save(unit: MotorcycleUnit): Promise<void>;
}

export const MOTORCYCLE_UNIT_REPOSITORY = Symbol('MotorcycleUnitRepository');
