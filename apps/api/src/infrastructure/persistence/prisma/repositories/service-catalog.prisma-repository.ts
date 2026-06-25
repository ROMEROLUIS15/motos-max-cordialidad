import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import {
  ServiceCatalogRepository,
  ServiceCatalogFilters,
} from '../../../../domain/repositories/service-catalog.repository';
import { ServiceCatalogItem } from '../../../../domain/entities/service-catalog.entity';
import { Pagination, PaginatedResult, paginationToSkipTake } from '../../../../domain/shared/pagination';

type Row = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  estimatedHours: Prisma.Decimal;
  suggestedPrice: Prisma.Decimal;
  serviceType: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class ServiceCatalogPrismaRepository implements ServiceCatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(r: Row): ServiceCatalogItem {
    return new ServiceCatalogItem(
      r.id, r.tenantId, r.name, r.description, Number(r.estimatedHours),
      Number(r.suggestedPrice), r.serviceType, r.isActive, r.createdAt, r.updatedAt,
    );
  }

  async findById(id: string, tenantId: string): Promise<ServiceCatalogItem | null> {
    const r = await this.prisma.serviceCatalogItem.findFirst({ where: { id, tenantId } });
    return r ? this.toDomain(r) : null;
  }

  async findAll(
    tenantId: string,
    filters: ServiceCatalogFilters,
    pagination: Pagination,
  ): Promise<PaginatedResult<ServiceCatalogItem>> {
    const where: Prisma.ServiceCatalogItemWhereInput = { tenantId };
    if (filters.serviceType) where.serviceType = filters.serviceType;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.search) where.name = { contains: filters.search, mode: 'insensitive' };

    const { skip, take } = paginationToSkipTake(pagination);
    const [rows, total] = await Promise.all([
      this.prisma.serviceCatalogItem.findMany({ where, orderBy: { name: 'asc' }, skip, take }),
      this.prisma.serviceCatalogItem.count({ where }),
    ]);
    return {
      items: rows.map((r) => this.toDomain(r)),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
    };
  }

  async create(item: ServiceCatalogItem): Promise<void> {
    await this.prisma.serviceCatalogItem.create({
      data: {
        id: item.id, tenantId: item.tenantId, name: item.name, description: item.description,
        estimatedHours: item.estimatedHours, suggestedPrice: item.suggestedPrice,
        serviceType: item.serviceType, isActive: item.isActive,
        createdAt: item.createdAt, updatedAt: item.updatedAt,
      },
    });
  }

  async save(item: ServiceCatalogItem): Promise<void> {
    await this.prisma.serviceCatalogItem.update({
      where: { id: item.id },
      data: {
        name: item.name, description: item.description, estimatedHours: item.estimatedHours,
        suggestedPrice: item.suggestedPrice, serviceType: item.serviceType,
        isActive: item.isActive, updatedAt: item.updatedAt,
      },
    });
  }
}
