import { DeactivateVehicleUseCase } from './deactivate-vehicle.use-case';
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
  const vehicleRepo = {
    findById: jest.fn().mockResolvedValue(makeVehicle()),
    hasActiveWorkOrder: jest.fn().mockResolvedValue(false),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const useCase = new DeactivateVehicleUseCase(vehicleRepo as never);
  return { useCase, vehicleRepo };
}

describe('DeactivateVehicleUseCase', () => {
  it('throws NotFoundException when the vehicle does not exist for the tenant', async () => {
    const { useCase, vehicleRepo } = make();
    vehicleRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('veh-1', 'tenant-1')).rejects.toMatchObject({ status: 404 });
  });

  it('throws ConflictException when the vehicle has an active work order', async () => {
    const { useCase, vehicleRepo } = make();
    vehicleRepo.hasActiveWorkOrder.mockResolvedValue(true);
    await expect(useCase.execute('veh-1', 'tenant-1')).rejects.toMatchObject({ status: 409 });
    expect(vehicleRepo.save).not.toHaveBeenCalled();
  });

  it('deactivates and persists the vehicle when there is no active work order', async () => {
    const { useCase, vehicleRepo } = make();
    await useCase.execute('veh-1', 'tenant-1');
    const saved = vehicleRepo.save.mock.calls[0][0] as Vehicle;
    expect(saved.deletedAt).not.toBeNull();
  });
});
