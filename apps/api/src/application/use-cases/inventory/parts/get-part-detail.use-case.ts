import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PartRepository, PART_REPOSITORY } from '../../../../domain/repositories/part.repository';
import {
  PartStockRepository,
  PART_STOCK_REPOSITORY,
} from '../../../../domain/repositories/part-stock.repository';

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
