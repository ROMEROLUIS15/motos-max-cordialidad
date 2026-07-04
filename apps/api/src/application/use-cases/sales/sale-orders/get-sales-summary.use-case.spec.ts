import { GetSalesSummaryUseCase } from './get-sales-summary.use-case';
import { SalesSummary } from '../../../../domain/repositories/sale-order.repository';

const summary: SalesSummary = {
  period: { from: '2026-01-01', to: '2026-07-01' },
  sales: {
    confirmedCount: 3,
    confirmedRevenue: 30_000_000,
    draftCount: 1,
    cancelledCount: 0,
    avgTicket: 10_000_000,
  },
  inventory: { available: 5, reserved: 1, sold: 3 },
  topBrands: [],
  monthlyTrend: [],
};

describe('GetSalesSummaryUseCase', () => {
  it('uses the explicit from/to range when provided', async () => {
    const orderRepo = { summary: jest.fn().mockResolvedValue(summary) };
    const useCase = new GetSalesSummaryUseCase(orderRepo as never);
    const from = new Date('2026-01-01');
    const to = new Date('2026-02-01');

    await useCase.execute({ tenantId: 'tenant-1', from, to });

    expect(orderRepo.summary).toHaveBeenCalledWith('tenant-1', from, to);
  });

  it('defaults to a 6-month trailing window ending today when no range is given', async () => {
    const orderRepo = { summary: jest.fn().mockResolvedValue(summary) };
    const useCase = new GetSalesSummaryUseCase(orderRepo as never);

    await useCase.execute({ tenantId: 'tenant-1' });

    const [tenantId, from, to] = orderRepo.summary.mock.calls[0];
    expect(tenantId).toBe('tenant-1');
    expect(to.getDate()).toBe(new Date().getDate());
    expect(from.getMonth()).toBe((to.getMonth() - 5 + 12) % 12);
    expect(from.getDate()).toBe(1);
  });
});
