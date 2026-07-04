import { GetAgentsDashboardSummaryUseCase } from './get-agents-dashboard-summary.use-case';

function make() {
  const payments = { sumByTenantAndPeriod: jest.fn().mockResolvedValue(1_000_000) };
  const workOrders = { countCompletedInPeriod: jest.fn().mockResolvedValue(4) };
  const useCase = new GetAgentsDashboardSummaryUseCase(payments as never, workOrders as never);
  return { useCase, payments, workOrders };
}

describe('GetAgentsDashboardSummaryUseCase', () => {
  it('computes the average ticket from total income and completed orders', async () => {
    const { useCase } = make();
    const from = new Date('2026-06-01');
    const to = new Date('2026-06-30');

    const result = await useCase.execute({ tenantId: 'tenant-1', from, to });

    expect(result).toEqual({
      tenantId: 'tenant-1',
      periodStart: from.toISOString(),
      periodEnd: to.toISOString(),
      totalIncome: 1_000_000,
      completedOrders: 4,
      avgTicket: 250_000,
    });
  });

  it('avoids a divide-by-zero and reports avgTicket 0 when there are no completed orders', async () => {
    const { useCase, workOrders } = make();
    workOrders.countCompletedInPeriod.mockResolvedValue(0);

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      from: new Date(),
      to: new Date(),
    });

    expect(result.avgTicket).toBe(0);
  });

  it('forwards the branchId filter to both repositories', async () => {
    const { useCase, payments, workOrders } = make();
    const from = new Date();
    const to = new Date();

    await useCase.execute({ tenantId: 'tenant-1', from, to, branchId: 'branch-1' });

    expect(payments.sumByTenantAndPeriod).toHaveBeenCalledWith('tenant-1', from, to, 'branch-1');
    expect(workOrders.countCompletedInPeriod).toHaveBeenCalledWith(
      'tenant-1',
      from,
      to,
      'branch-1',
    );
  });
});
