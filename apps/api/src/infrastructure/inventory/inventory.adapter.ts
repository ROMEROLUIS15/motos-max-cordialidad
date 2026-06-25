import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InventoryPort } from '../../application/ports/inventory.port';
import {
  PartStockRepository,
  PART_STOCK_REPOSITORY,
} from '../../domain/repositories/part-stock.repository';
import {
  StockEntryRepository,
  STOCK_ENTRY_REPOSITORY,
} from '../../domain/repositories/stock-entry.repository';
import { StockEntryType } from '../../domain/value-objects/stock-entry-type.vo';
import { PrismaService } from '../persistence/prisma/prisma.service';

/**
 * Real InventoryPort implementation (replaces InventoryStubAdapter from Epic 4).
 * Operates on the three-level stock model via PartStockRepository.
 */
@Injectable()
export class InventoryAdapter implements InventoryPort {
  constructor(
    @Inject(PART_STOCK_REPOSITORY) private readonly stockRepo: PartStockRepository,
    @Inject(STOCK_ENTRY_REPOSITORY) private readonly entryRepo: StockEntryRepository,
    private readonly prisma: PrismaService,
  ) {}

  async reserveStock(partId: string, branchId: string, quantity: number): Promise<void> {
    const stock = await this.stockRepo.ensureExists(partId, branchId);
    stock.reserve(quantity); // throws InsufficientStockException if not enough available
    await this.stockRepo.save(stock);
  }

  async releaseReservation(partId: string, branchId: string, quantity: number): Promise<void> {
    const stock = await this.stockRepo.findByPartAndBranch(partId, branchId);
    if (!stock) return;
    stock.releaseReservation(quantity);
    await this.stockRepo.save(stock);
  }

  async releaseAllReservations(workOrderId: string): Promise<void> {
    const { branchId, parts } = await this.workOrderParts(workOrderId);
    for (const p of parts) {
      const stock = await this.stockRepo.findByPartAndBranch(p.partId, branchId);
      if (!stock) continue;
      stock.releaseReservation(p.quantity);
      await this.stockRepo.save(stock);
    }
  }

  async confirmStockDiscount(workOrderId: string, tenantId: string): Promise<void> {
    const { branchId, parts } = await this.workOrderParts(workOrderId);
    for (const p of parts) {
      const stock = await this.stockRepo.findByPartAndBranch(p.partId, branchId);
      if (!stock) continue;
      stock.confirmDiscount(p.quantity);
      await this.stockRepo.save(stock);
      await this.entryRepo.create({
        id: randomUUID(),
        tenantId,
        partId: p.partId,
        branchId,
        type: StockEntryType.SALIDA,
        quantity: p.quantity,
        userId: 'system',
        referenceId: workOrderId,
        notes: 'Descuento por entrega de orden de trabajo',
        createdAt: new Date(),
      });
    }
  }

  private async workOrderParts(
    workOrderId: string,
  ): Promise<{ branchId: string; parts: Array<{ partId: string; quantity: number }> }> {
    const wo = await this.prisma.workOrder.findUnique({
      where: { id: workOrderId },
      select: { branchId: true, parts: { select: { partId: true, quantity: true } } },
    });
    if (!wo) return { branchId: '', parts: [] };
    return {
      branchId: wo.branchId,
      parts: wo.parts.map((p) => ({ partId: p.partId, quantity: Number(p.quantity) })),
    };
  }
}
