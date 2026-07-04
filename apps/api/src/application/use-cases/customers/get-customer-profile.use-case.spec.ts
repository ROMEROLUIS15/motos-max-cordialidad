import { GetCustomerProfileUseCase } from './get-customer-profile.use-case';

function make() {
  const customerRepo = {
    findById: jest.fn().mockResolvedValue({ id: 'cust-1', fullName: 'Juan Perez' }),
  };
  const vehicleRepo = {
    findByCustomer: jest.fn().mockResolvedValue([{ id: 'veh-1', plate: 'ABC123' }]),
  };
  const workOrderRepo = {
    findRecentByCustomer: jest.fn().mockResolvedValue([{ id: 'wo-1', orderNumber: 'WO-1' }]),
  };
  const useCase = new GetCustomerProfileUseCase(
    customerRepo as never,
    vehicleRepo as never,
    workOrderRepo as never,
  );
  return { useCase, customerRepo, vehicleRepo, workOrderRepo };
}

describe('GetCustomerProfileUseCase', () => {
  it('throws NotFoundException when the customer does not exist for the tenant', async () => {
    const { useCase, customerRepo } = make();
    customerRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('cust-1', 'tenant-1')).rejects.toMatchObject({ status: 404 });
  });

  it('returns the customer together with their vehicles and 10 most recent orders', async () => {
    const { useCase, workOrderRepo } = make();
    const result = await useCase.execute('cust-1', 'tenant-1');

    expect(result.customer.id).toBe('cust-1');
    expect(result.vehicles).toEqual([{ id: 'veh-1', plate: 'ABC123' }]);
    expect(result.recentWorkOrders).toEqual([{ id: 'wo-1', orderNumber: 'WO-1' }]);
    expect(workOrderRepo.findRecentByCustomer).toHaveBeenCalledWith('cust-1', 'tenant-1', 10);
  });
});
