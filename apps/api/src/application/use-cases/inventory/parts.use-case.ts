import { Inject, Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Part } from '../../../domain/entities/part.entity';
import {
  PartRepository,
  PART_REPOSITORY,
  PartSearchFilters,
  PartWithStock,
} from '../../../domain/repositories/part.repository';
import {
  PartStockRepository,
  PART_STOCK_REPOSITORY,
} from '../../../domain/repositories/part-stock.repository';
import { Pagination, PaginatedResult } from '../../../domain/shared/pagination';

export interface RegisterPartInput {
  tenantId: string;
  branchId: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  costPrice: number;
  salePrice: number;
  description?: string;
  brand?: string;
  supplierReference?: string;
  minStockAlert?: number;
  warehouseLocation?: string;
}

@Injectable()
export class RegisterPartUseCase {
  constructor(
    @Inject(PART_REPOSITORY) private readonly partRepo: PartRepository,
    @Inject(PART_STOCK_REPOSITORY) private readonly stockRepo: PartStockRepository,
  ) {}

  async execute(input: RegisterPartInput): Promise<Part> {
    const existing = await this.partRepo.findBySku(input.sku, input.tenantId);
    if (existing) throw new ConflictException(`SKU ${input.sku} ya existe en este tenant`);

    const now = new Date();
    const part = new Part(
      randomUUID(), input.tenantId, input.sku, input.name, input.category, input.unit,
      input.costPrice, input.salePrice, input.description ?? null, input.brand ?? null,
      input.supplierReference ?? null, null, input.minStockAlert ?? null,
      input.warehouseLocation ?? null, true, now, now,
    );
    await this.partRepo.create(part);
    // Initial zeroed stock for the current branch.
    await this.stockRepo.ensureExists(part.id, input.branchId);
    return part;
  }
}

export interface UpdatePartInput {
  tenantId: string;
  partId: string;
  name?: string;
  category?: string;
  unit?: string;
  costPrice?: number;
  salePrice?: number;
  description?: string | null;
  brand?: string | null;
  supplierReference?: string | null;
  minStockAlert?: number | null;
  warehouseLocation?: string | null;
}

@Injectable()
export class UpdatePartUseCase {
  constructor(@Inject(PART_REPOSITORY) private readonly partRepo: PartRepository) {}

  async execute(input: UpdatePartInput): Promise<void> {
    const part = await this.partRepo.findById(input.partId, input.tenantId);
    if (!part) throw new NotFoundException('Repuesto no encontrado');

    if (input.name !== undefined) part.name = input.name;
    if (input.category !== undefined) part.category = input.category;
    if (input.unit !== undefined) part.unit = input.unit;
    if (input.description !== undefined) part.description = input.description;
    if (input.brand !== undefined) part.brand = input.brand;
    if (input.supplierReference !== undefined) part.supplierReference = input.supplierReference;
    if (input.minStockAlert !== undefined) part.minStockAlert = input.minStockAlert;
    if (input.warehouseLocation !== undefined) part.warehouseLocation = input.warehouseLocation;
    // Price change does NOT affect existing WorkOrderParts (frozen price).
    if (input.costPrice !== undefined || input.salePrice !== undefined) {
      part.updatePrices(input.costPrice ?? part.costPrice, input.salePrice ?? part.salePrice);
    } else {
      part.updatedAt = new Date();
    }
    await this.partRepo.save(part);
  }
}

@Injectable()
export class DeactivatePartUseCase {
  constructor(@Inject(PART_REPOSITORY) private readonly partRepo: PartRepository) {}

  async execute(partId: string, tenantId: string): Promise<void> {
    const part = await this.partRepo.findById(partId, tenantId);
    if (!part) throw new NotFoundException('Repuesto no encontrado');
    part.deactivate();
    await this.partRepo.save(part);
  }
}

export interface SearchPartsInput extends PartSearchFilters {
  tenantId: string;
  branchId: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class SearchPartsUseCase {
  constructor(@Inject(PART_REPOSITORY) private readonly partRepo: PartRepository) {}

  async execute(input: SearchPartsInput): Promise<PaginatedResult<PartWithStock>> {
    const pagination: Pagination = { page: input.page ?? 1, pageSize: input.pageSize ?? 20 };
    return this.partRepo.searchWithStock(
      { query: input.query, category: input.category },
      input.tenantId,
      input.branchId,
      pagination,
    );
  }
}

@Injectable()
export class GetPartDetailUseCase {
  constructor(
    @Inject(PART_REPOSITORY) private readonly partRepo: PartRepository,
    @Inject(PART_STOCK_REPOSITORY) private readonly stockRepo: PartStockRepository,
  ) {}

  async execute(partId: string, tenantId: string, branchId?: string) {
    const part = await this.partRepo.findById(partId, tenantId);
    if (!part) throw new NotFoundException('Repuesto no encontrado');
    const stock = branchId ? await this.stockRepo.findByPartAndBranch(partId, branchId) : null;
    return {
      part,
      stock: stock
        ? {
            stockFisico: stock.stockFisico,
            stockReservado: stock.stockReservado,
            stockDisponible: stock.stockDisponible,
          }
        : null,
    };
  }
}
