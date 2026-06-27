import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import {
  MotorcycleUnitRepository,
  MotorcycleUnitSearchFilters,
} from '../../../../domain/repositories/motorcycle-unit.repository';
import {
  MotorcycleUnit,
  MotorcycleCondition,
  MotorcycleStatus,
} from '../../../../domain/entities/motorcycle-unit.entity';
import {
  Pagination,
  PaginatedResult,
  paginationToSkipTake,
} from '../../../../domain/shared/pagination';

type MotorcycleUnitRow = {
  id: string;
  tenantId: string;
  branchId: string;
  vin: string;
  brand: string;
  model: string;
  year: number;
  displacement: number | null;
  color: string | null;
  condition: string;
  mileage: number;
  engineNumber: string | null;
  plate: string | null;
  costPrice: Prisma.Decimal;
  salePrice: Prisma.Decimal;
  status: string;
  description: string | null;
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class MotorcycleUnitPrismaRepository implements MotorcycleUnitRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(r: MotorcycleUnitRow): MotorcycleUnit {
    return new MotorcycleUnit(
      r.id,
      r.tenantId,
      r.branchId,
      r.vin,
      r.brand,
      r.model,
      r.year,
      r.displacement,
      r.color,
      r.condition as MotorcycleCondition,
      r.mileage,
      r.engineNumber,
      r.plate,
      Number(r.costPrice),
      Number(r.salePrice),
      r.status as MotorcycleStatus,
      r.description,
      r.imageUrl,
      r.createdAt,
      r.updatedAt,
    );
  }

  async findById(id: string, tenantId: string): Promise<MotorcycleUnit | null> {
    const r = await this.prisma.motorcycleUnit.findFirst({ where: { id, tenantId } });
    return r ? this.toDomain(r) : null;
  }

  async findByVin(vin: string, tenantId: string): Promise<MotorcycleUnit | null> {
    const r = await this.prisma.motorcycleUnit.findFirst({ where: { vin, tenantId } });
    return r ? this.toDomain(r) : null;
  }

  async search(
    filters: MotorcycleUnitSearchFilters,
    tenantId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<MotorcycleUnit>> {
    const where: Prisma.MotorcycleUnitWhereInput = { tenantId };
    if (filters.status) where.status = filters.status;
    if (filters.condition) where.condition = filters.condition;
    if (filters.branchId) where.branchId = filters.branchId;
    if (filters.query) {
      where.OR = [
        { brand: { contains: filters.query, mode: 'insensitive' } },
        { model: { contains: filters.query, mode: 'insensitive' } },
        { vin: { contains: filters.query, mode: 'insensitive' } },
        { plate: { contains: filters.query, mode: 'insensitive' } },
      ];
    }
    const { skip, take } = paginationToSkipTake(pagination);
    const [rows, total] = await Promise.all([
      this.prisma.motorcycleUnit.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.motorcycleUnit.count({ where }),
    ]);
    return {
      items: rows.map((r) => this.toDomain(r)),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
    };
  }

  async create(unit: MotorcycleUnit): Promise<void> {
    await this.prisma.motorcycleUnit.create({
      data: {
        id: unit.id,
        tenantId: unit.tenantId,
        branchId: unit.branchId,
        vin: unit.vin,
        brand: unit.brand,
        model: unit.model,
        year: unit.year,
        displacement: unit.displacement,
        color: unit.color,
        condition: unit.condition,
        mileage: unit.mileage,
        engineNumber: unit.engineNumber,
        plate: unit.plate,
        costPrice: unit.costPrice,
        salePrice: unit.salePrice,
        status: unit.status,
        description: unit.description,
        imageUrl: unit.imageUrl,
        createdAt: unit.createdAt,
        updatedAt: unit.updatedAt,
      },
    });
  }

  async save(unit: MotorcycleUnit): Promise<void> {
    await this.prisma.motorcycleUnit.update({
      where: { id: unit.id },
      data: {
        branchId: unit.branchId,
        brand: unit.brand,
        model: unit.model,
        year: unit.year,
        displacement: unit.displacement,
        color: unit.color,
        condition: unit.condition,
        mileage: unit.mileage,
        engineNumber: unit.engineNumber,
        plate: unit.plate,
        costPrice: unit.costPrice,
        salePrice: unit.salePrice,
        status: unit.status,
        description: unit.description,
        imageUrl: unit.imageUrl,
        updatedAt: unit.updatedAt,
      },
    });
  }
}
