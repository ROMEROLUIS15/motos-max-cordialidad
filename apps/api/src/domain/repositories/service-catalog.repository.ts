import { ServiceCatalogItem } from '../entities/service-catalog.entity';
import { Pagination, PaginatedResult } from '../shared/pagination';

export interface ServiceCatalogFilters {
  serviceType?: string;
  search?: string;
  isActive?: boolean;
}

export interface ServiceCatalogRepository {
  findById(id: string, tenantId: string): Promise<ServiceCatalogItem | null>;
  findAll(
    tenantId: string,
    filters: ServiceCatalogFilters,
    pagination: Pagination,
  ): Promise<PaginatedResult<ServiceCatalogItem>>;
  create(item: ServiceCatalogItem): Promise<void>;
  save(item: ServiceCatalogItem): Promise<void>;
}

export const SERVICE_CATALOG_REPOSITORY = Symbol('ServiceCatalogRepository');
