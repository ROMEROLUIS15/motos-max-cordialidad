import { Inject, Injectable } from '@nestjs/common';
import {
  PartStockRepository,
  PART_STOCK_REPOSITORY,
} from '../../../../domain/repositories/part-stock.repository';
import {
  StockEntryRepository,
  STOCK_ENTRY_REPOSITORY,
} from '../../../../domain/repositories/stock-entry.repository';

export interface AgentsInventoryInput {
  tenantId: string;
  branchId?: string;
  daysLookback?: number;
}

@Injectable()
export class GetAgentsInventoryStatusUseCase {
  constructor(
    @Inject(PART_STOCK_REPOSITORY) private readonly stock: PartStockRepository,
    @Inject(STOCK_ENTRY_REPOSITORY) private readonly entries: StockEntryRepository,
  ) {}

  async execute(input: AgentsInventoryInput) {
    const daysLookback = input.daysLookback && input.daysLookback > 0 ? input.daysLookback : 30;
    const to = new Date();
    const from = new Date(to.getTime() - daysLookback * 24 * 60 * 60 * 1000);

    const [lowStock, consumption] = await Promise.all([
      this.stock.findLowStockByTenant(input.tenantId, input.branchId),
      this.entries.consumptionByPart(input.tenantId, from, to, input.branchId),
    ]);

    const outByPart = new Map(consumption.map((c) => [c.partId, c.totalOut]));

    const items = lowStock.map((item) => {
      const totalOut = outByPart.get(item.partId) ?? 0;
      const dailyConsumption = Math.round((totalOut / daysLookback) * 100) / 100;
      const daysRemaining =
        dailyConsumption > 0 ? Math.floor(item.stockDisponible / dailyConsumption) : null;
      const suggestedReorderQty = Math.max(
        Math.ceil(dailyConsumption * daysLookback) - item.stockDisponible,
        Math.ceil(item.minStockAlert - item.stockDisponible),
        1,
      );
      return {
        partId: item.partId,
        sku: item.sku,
        name: item.name,
        branchId: item.branchId,
        stockDisponible: item.stockDisponible,
        minStockAlert: item.minStockAlert,
        dailyConsumption,
        daysRemaining,
        suggestedReorderQty,
      };
    });

    return { tenantId: input.tenantId, daysLookback, criticalCount: items.length, items };
  }
}
