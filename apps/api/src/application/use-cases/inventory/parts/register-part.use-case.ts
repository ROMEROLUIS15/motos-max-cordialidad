import { Inject, Injectable, ConflictException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Part } from '../../../../domain/entities/part.entity';
import { PartRepository, PART_REPOSITORY } from '../../../../domain/repositories/part.repository';
import {
  PartStockRepository,
  PART_STOCK_REPOSITORY,
} from '../../../../domain/repositories/part-stock.repository';

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
      randomUUID(),
      input.tenantId,
      input.sku,
      input.name,
      input.category,
      input.unit,
      input.costPrice,
      input.salePrice,
      input.description ?? null,
      input.brand ?? null,
      input.supplierReference ?? null,
      null,
      input.minStockAlert ?? null,
      input.warehouseLocation ?? null,
      true,
      now,
      now,
    );
    await this.partRepo.create(part);
    await this.stockRepo.ensureExists(part.id, input.branchId);
    return part;
  }
}
