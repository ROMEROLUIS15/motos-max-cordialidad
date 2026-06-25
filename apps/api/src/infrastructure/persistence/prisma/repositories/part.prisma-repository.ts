import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import {
  PartRepository,
  PartSearchFilters,
  PartWithStock,
} from '../../../../domain/repositories/part.repository';
import { Part } from '../../../../domain/entities/part.entity';
import { Pagination, PaginatedResult, paginationToSkipTake } from '../../../../domain/shared/pagination';

type PartRow = {
  id: string;
  tenantId: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  costPrice: Prisma.Decimal;
  salePrice: Prisma.Decimal;
  description: string | null;
  brand: string | null;
  supplierReference: string | null;
  imageUrl: string | null;
  minStockAlert: Prisma.Decimal | null;
  warehouseLocation: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class PartPrismaRepository implements PartRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(r: PartRow): Part {
    return new Part(
      r.id, r.tenantId, r.sku, r.name, r.category, r.unit,
      Number(r.costPrice), Number(r.salePrice), r.description, r.brand,
      r.supplierReference, r.imageUrl, r.minStockAlert ? Number(r.minStockAlert) : null,
      r.warehouseLocation, r.isActive, r.createdAt, r.updatedAt,
    );
  }

  async findById(id: string, tenantId: string): Promise<Part | null> {
    const r = await this.prisma.part.findFirst({ where: { id, tenantId } });
    return r ? this.toDomain(r) : null;
  }

  async findBySku(sku: string, tenantId: string): Promise<Part | null> {
    const r = await this.prisma.part.findFirst({ where: { sku, tenantId } });
    return r ? this.toDomain(r) : null;
  }

  async search(
    filters: PartSearchFilters,
    tenantId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<Part>> {
    const where: Prisma.PartWhereInput = { tenantId };
    if (filters.category) where.category = filters.category;
    if (filters.query) {
      where.OR = [
        { name: { contains: filters.query, mode: 'insensitive' } },
        { sku: { contains: filters.query, mode: 'insensitive' } },
      ];
    }
    const { skip, take } = paginationToSkipTake(pagination);
    const [rows, total] = await Promise.all([
      this.prisma.part.findMany({ where, orderBy: { name: 'asc' }, skip, take }),
      this.prisma.part.count({ where }),
    ]);
    return {
      items: rows.map((r) => this.toDomain(r)),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
    };
  }

  async searchWithStock(
    filters: PartSearchFilters,
    tenantId: string,
    branchId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<PartWithStock>> {
    const where: Prisma.PartWhereInput = { tenantId };
    if (filters.category) where.category = filters.category;
    if (filters.query) {
      where.OR = [
        { name: { contains: filters.query, mode: 'insensitive' } },
        { sku: { contains: filters.query, mode: 'insensitive' } },
      ];
    }
    const { skip, take } = paginationToSkipTake(pagination);
    const [rows, total] = await Promise.all([
      this.prisma.part.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take,
        include: { branchStocks: { where: { branchId } } },
      }),
      this.prisma.part.count({ where }),
    ]);

    const items: PartWithStock[] = rows.map((r) => {
      const stock = r.branchStocks[0];
      const fisico = stock ? Number(stock.stockFisico) : 0;
      const reservado = stock ? Number(stock.stockReservado) : 0;
      const disponible = fisico - reservado;
      const min = r.minStockAlert ? Number(r.minStockAlert) : null;
      return {
        id: r.id,
        sku: r.sku,
        name: r.name,
        category: r.category,
        unit: r.unit,
        salePrice: Number(r.salePrice),
        costPrice: Number(r.costPrice),
        minStockAlert: min,
        isActive: r.isActive,
        stockFisico: fisico,
        stockReservado: reservado,
        stockDisponible: disponible,
        lowStock: min !== null && disponible < min,
      };
    });
    return { items, total, page: pagination.page, pageSize: pagination.pageSize };
  }

  async create(part: Part): Promise<void> {
    await this.prisma.part.create({
      data: {
        id: part.id, tenantId: part.tenantId, sku: part.sku, name: part.name,
        category: part.category, unit: part.unit, costPrice: part.costPrice,
        salePrice: part.salePrice, description: part.description, brand: part.brand,
        supplierReference: part.supplierReference, imageUrl: part.imageUrl,
        minStockAlert: part.minStockAlert, warehouseLocation: part.warehouseLocation,
        isActive: part.isActive, createdAt: part.createdAt, updatedAt: part.updatedAt,
      },
    });
  }

  async save(part: Part): Promise<void> {
    await this.prisma.part.update({
      where: { id: part.id },
      data: {
        name: part.name, category: part.category, unit: part.unit,
        costPrice: part.costPrice, salePrice: part.salePrice, description: part.description,
        brand: part.brand, supplierReference: part.supplierReference, imageUrl: part.imageUrl,
        minStockAlert: part.minStockAlert, warehouseLocation: part.warehouseLocation,
        isActive: part.isActive, updatedAt: part.updatedAt,
      },
    });
  }
}
