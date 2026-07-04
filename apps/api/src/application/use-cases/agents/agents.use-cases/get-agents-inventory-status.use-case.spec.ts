import { GetAgentsInventoryStatusUseCase } from './get-agents-inventory-status.use-case';

function make() {
  const stock = {
    findLowStockByTenant: jest
      .fn()
      .mockResolvedValue([
        {
          partId: 'part-1',
          sku: 'SKU-1',
          name: 'Bujia NGK',
          branchId: 'branch-1',
          stockDisponible: 3,
          minStockAlert: 10,
        },
      ]),
  };
  const entries = {
    consumptionByPart: jest.fn().mockResolvedValue([{ partId: 'part-1', totalOut: 60 }]),
  };
  const useCase = new GetAgentsInventoryStatusUseCase(stock as never, entries as never);
  return { useCase, stock, entries };
}

describe('GetAgentsInventoryStatusUseCase', () => {
  it('defaults daysLookback to 30 and computes daily consumption / days remaining / reorder suggestion', async () => {
    const { useCase } = make();
    const result = await useCase.execute({ tenantId: 'tenant-1' });

    expect(result.daysLookback).toBe(30);
    expect(result.criticalCount).toBe(1);
    const item = result.items[0];
    expect(item.dailyConsumption).toBe(2); // 60 out / 30 days
    expect(item.daysRemaining).toBe(1); // floor(3 / 2)
    // max(ceil(2*30)-3, ceil(10-3), 1) = max(57, 7, 1) = 57
    expect(item.suggestedReorderQty).toBe(57);
  });

  it('falls back to a non-positive daysLookback default of 30', async () => {
    const { useCase, entries } = make();
    await useCase.execute({ tenantId: 'tenant-1', daysLookback: -5 });
    expect(entries.consumptionByPart).toHaveBeenCalledWith(
      'tenant-1',
      expect.any(Date),
      expect.any(Date),
      undefined,
    );
  });

  it('reports daysRemaining as null when there is no recent consumption', async () => {
    const { useCase, entries } = make();
    entries.consumptionByPart.mockResolvedValue([]);
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    expect(result.items[0].dailyConsumption).toBe(0);
    expect(result.items[0].daysRemaining).toBeNull();
  });

  it('forwards the branchId filter to both repositories', async () => {
    const { useCase, stock, entries } = make();
    await useCase.execute({ tenantId: 'tenant-1', branchId: 'branch-1' });
    expect(stock.findLowStockByTenant).toHaveBeenCalledWith('tenant-1', 'branch-1');
    expect(entries.consumptionByPart).toHaveBeenCalledWith(
      'tenant-1',
      expect.any(Date),
      expect.any(Date),
      'branch-1',
    );
  });
});
