import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ServiceCatalogItem } from '../../../domain/entities/service-catalog.entity';
import {
  ServiceCatalogRepository,
  SERVICE_CATALOG_REPOSITORY,
  ServiceCatalogFilters,
} from '../../../domain/repositories/service-catalog.repository';
import { Pagination, PaginatedResult } from '../../../domain/shared/pagination';

export interface CreateServiceCatalogItemInput {
  tenantId: string;
  name: string;
  description?: string;
  estimatedHours: number;
  suggestedPrice: number;
  serviceType: string;
}

@Injectable()
export class CreateServiceCatalogItemUseCase {
  constructor(
    @Inject(SERVICE_CATALOG_REPOSITORY) private readonly repo: ServiceCatalogRepository,
  ) {}

  async execute(input: CreateServiceCatalogItemInput): Promise<ServiceCatalogItem> {
    const now = new Date();
    const item = new ServiceCatalogItem(
      randomUUID(), input.tenantId, input.name, input.description ?? null,
      input.estimatedHours, input.suggestedPrice, input.serviceType, true, now, now,
    );
    await this.repo.create(item);
    return item;
  }
}

export interface UpdateServiceCatalogItemInput {
  tenantId: string;
  id: string;
  name?: string;
  description?: string | null;
  estimatedHours?: number;
  suggestedPrice?: number;
  serviceType?: string;
}

@Injectable()
export class UpdateServiceCatalogItemUseCase {
  constructor(
    @Inject(SERVICE_CATALOG_REPOSITORY) private readonly repo: ServiceCatalogRepository,
  ) {}

  async execute(input: UpdateServiceCatalogItemInput): Promise<void> {
    const item = await this.repo.findById(input.id, input.tenantId);
    if (!item) throw new NotFoundException('Ítem de catálogo no encontrado');
    item.update({
      name: input.name,
      description: input.description ?? undefined,
      estimatedHours: input.estimatedHours,
      suggestedPrice: input.suggestedPrice,
      serviceType: input.serviceType,
    });
    await this.repo.save(item);
  }
}

@Injectable()
export class DeactivateServiceCatalogItemUseCase {
  constructor(
    @Inject(SERVICE_CATALOG_REPOSITORY) private readonly repo: ServiceCatalogRepository,
  ) {}

  async execute(id: string, tenantId: string): Promise<void> {
    const item = await this.repo.findById(id, tenantId);
    if (!item) throw new NotFoundException('Ítem de catálogo no encontrado');
    item.deactivate();
    await this.repo.save(item);
  }
}

export interface ListServiceCatalogInput extends ServiceCatalogFilters {
  tenantId: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class ListServiceCatalogItemsUseCase {
  constructor(
    @Inject(SERVICE_CATALOG_REPOSITORY) private readonly repo: ServiceCatalogRepository,
  ) {}

  async execute(input: ListServiceCatalogInput): Promise<PaginatedResult<ServiceCatalogItem>> {
    const pagination: Pagination = { page: input.page ?? 1, pageSize: input.pageSize ?? 20 };
    return this.repo.findAll(
      input.tenantId,
      { serviceType: input.serviceType, search: input.search, isActive: input.isActive },
      pagination,
    );
  }
}
