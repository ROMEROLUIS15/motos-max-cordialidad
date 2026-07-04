import { GetVehicleHistoryUseCase } from './get-vehicle-history.use-case';
import { Vehicle } from '../../../domain/entities/vehicle.entity';

function makeVehicle(): Vehicle {
  const now = new Date();
  return new Vehicle(
    'veh-1',
    'tenant-1',
    'ABC123',
    'Yamaha',
    'FZ',
    2024,
    'Rojo',
    'ENG1',
    null,
    null,
    null,
    null,
    null,
    'cust-1',
    null,
    now,
    now,
  );
}

function make() {
  const vehicleRepo = { findById: jest.fn().mockResolvedValue(makeVehicle()) };
  const workOrderRepo = {
    findVehicleServiceHistory: jest.fn().mockResolvedValue([{ id: 'wo-1' }]),
  };
  const ownershipHistoryRepo = { findByVehicle: jest.fn().mockResolvedValue([{ id: 'hist-1' }]) };
  const useCase = new GetVehicleHistoryUseCase(
    vehicleRepo as never,
    workOrderRepo as never,
    ownershipHistoryRepo as never,
  );
  return { useCase, vehicleRepo, workOrderRepo, ownershipHistoryRepo };
}

describe('GetVehicleHistoryUseCase', () => {
  it('throws NotFoundException when the vehicle does not exist for the tenant', async () => {
    const { useCase, vehicleRepo } = make();
    vehicleRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('veh-1', 'tenant-1')).rejects.toMatchObject({ status: 404 });
  });

  it('returns the vehicle together with its work orders and ownership history', async () => {
    const { useCase, workOrderRepo, ownershipHistoryRepo } = make();
    const result = await useCase.execute('veh-1', 'tenant-1');

    expect(result.vehicle.id).toBe('veh-1');
    expect(result.workOrders).toEqual([{ id: 'wo-1' }]);
    expect(result.ownershipHistory).toEqual([{ id: 'hist-1' }]);
    expect(workOrderRepo.findVehicleServiceHistory).toHaveBeenCalledWith('veh-1', 'tenant-1');
    expect(ownershipHistoryRepo.findByVehicle).toHaveBeenCalledWith('veh-1');
  });
});
