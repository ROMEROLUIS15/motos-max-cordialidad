import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PartRepository, PART_REPOSITORY } from '../../../../domain/repositories/part.repository';

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
    if (input.costPrice !== undefined || input.salePrice !== undefined) {
      part.updatePrices(input.costPrice ?? part.costPrice, input.salePrice ?? part.salePrice);
    } else {
      part.updatedAt = new Date();
    }
    await this.partRepo.save(part);
  }
}
