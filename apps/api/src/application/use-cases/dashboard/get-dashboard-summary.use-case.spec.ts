import { GetDashboardSummaryUseCase } from './get-dashboard-summary.use-case';
import { WorkOrderStatus } from '../../../domain/value-objects/work-order-status.vo';

function make() {
  const workOrderRepo = {
    countActiveByStatus: jest.fn().mockResolvedValue({ PENDING: 2 }),
    avgCycleTimeHours: jest.fn().mockResolvedValue(12.345),
    findNearingDeadline: jest.fn().mockResolvedValue([]),
    technicianRanking: jest.fn().mockResolvedValue([]),
    countByStatusInPeriod: jest.fn().mockResolvedValue(2),
  };
  const paymentRepo = {
    sumByBranchAndPeriod: jest.fn().mockResolvedValue(100_000),
    incomeTrend: jest.fn().mockResolvedValue([]),
  };
  const stockRepo = {
    findLowStock: jest.fn().mockResolvedValue([{ partId: 'p1' }, { partId: 'p2' }]),
  };
  const stockEntryRepo = { topPartsByRotation: jest.fn().mockResolvedValue([]) };
  const useCase = new GetDashboardSummaryUseCase(
    workOrderRepo as never,
    paymentRepo as never,
    stockRepo as never,
    stockEntryRepo as never,
  );
  return { useCase, workOrderRepo, paymentRepo, stockRepo, stockEntryRepo };
}

describe('GetDashboardSummaryUseCase', () => {
  it('defaults the period to the current month-to-date when from/to are not given', async () => {
    const { useCase, paymentRepo } = make();
    const now = new Date();

    await useCase.execute({ tenantId: 'tenant-1', branchId: 'branch-1' });

    const monthCall = paymentRepo.sumByBranchAndPeriod.mock.calls[1];
    const [, , monthStart, monthEnd] = monthCall;
    expect(monthStart).toEqual(new Date(now.getFullYear(), now.getMonth(), 1));
    expect(monthEnd.getDate()).toBe(now.getDate());
  });

  it('rounds avgCycleHours to one decimal', async () => {
    const { useCase } = make();
    const result = await useCase.execute({ tenantId: 'tenant-1', branchId: 'branch-1' });
    expect(result.avgCycleHours).toBe(12.3);
  });

  it('reports lowStockCount as the low-stock list length', async () => {
    const { useCase } = make();
    const result = await useCase.execute({ tenantId: 'tenant-1', branchId: 'branch-1' });
    expect(result.lowStockCount).toBe(2);
  });

  it('flags nearing-deadline orders as overdue based on the promised delivery date', async () => {
    const { useCase, workOrderRepo } = make();
    const past = new Date(Date.now() - 86400000);
    const future = new Date(Date.now() + 86400000);
    workOrderRepo.findNearingDeadline.mockResolvedValue([
      {
        id: 'wo-1',
        orderNumber: 'WO-1',
        status: WorkOrderStatus.IN_PROGRESS,
        promisedDeliveryAt: past,
      },
      {
        id: 'wo-2',
        orderNumber: 'WO-2',
        status: WorkOrderStatus.IN_PROGRESS,
        promisedDeliveryAt: future,
      },
    ]);

    const result = await useCase.execute({ tenantId: 'tenant-1', branchId: 'branch-1' });

    expect(result.nearingDeadline[0].overdue).toBe(true);
    expect(result.nearingDeadline[1].overdue).toBe(false);
  });

  it('raises waitingPartsAlert only when more than 5 orders are waiting for parts', async () => {
    const { useCase, workOrderRepo } = make();
    workOrderRepo.countByStatusInPeriod.mockResolvedValue(6);
    const result = await useCase.execute({ tenantId: 'tenant-1', branchId: 'branch-1' });
    expect(result.waitingPartsAlert).toBe(true);
    expect(result.waitingPartsCount).toBe(6);
  });

  it('does not raise waitingPartsAlert at exactly 5', async () => {
    const { useCase, workOrderRepo } = make();
    workOrderRepo.countByStatusInPeriod.mockResolvedValue(5);
    const result = await useCase.execute({ tenantId: 'tenant-1', branchId: 'branch-1' });
    expect(result.waitingPartsAlert).toBe(false);
  });
});
