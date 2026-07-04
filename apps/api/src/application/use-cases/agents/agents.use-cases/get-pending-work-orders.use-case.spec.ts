import { GetPendingWorkOrdersUseCase } from './get-pending-work-orders.use-case';

describe('GetPendingWorkOrdersUseCase', () => {
  it('flags an order as overdue when its promised delivery date is in the past', async () => {
    const past = new Date(Date.now() - 86400000);
    const workOrders = {
      findPendingByTenant: jest
        .fn()
        .mockResolvedValue([
          {
            id: 'wo-1',
            orderNumber: 'WO-1',
            status: 'PENDING',
            customerId: 'cust-1',
            vehicleId: 'veh-1',
            promisedDeliveryAt: past,
          },
        ]),
    };
    const useCase = new GetPendingWorkOrdersUseCase(workOrders as never);

    const result = await useCase.execute('tenant-1');

    expect(result[0].overdue).toBe(true);
  });

  it('does not flag an order as overdue when its promised delivery date is in the future', async () => {
    const future = new Date(Date.now() + 86400000);
    const workOrders = {
      findPendingByTenant: jest
        .fn()
        .mockResolvedValue([
          {
            id: 'wo-1',
            orderNumber: 'WO-1',
            status: 'PENDING',
            customerId: 'cust-1',
            vehicleId: 'veh-1',
            promisedDeliveryAt: future,
          },
        ]),
    };
    const useCase = new GetPendingWorkOrdersUseCase(workOrders as never);

    const result = await useCase.execute('tenant-1');

    expect(result[0].overdue).toBe(false);
  });

  it('forwards the branchId filter to the repository', async () => {
    const workOrders = { findPendingByTenant: jest.fn().mockResolvedValue([]) };
    const useCase = new GetPendingWorkOrdersUseCase(workOrders as never);
    await useCase.execute('tenant-1', 'branch-1');
    expect(workOrders.findPendingByTenant).toHaveBeenCalledWith('tenant-1', 'branch-1');
  });
});
