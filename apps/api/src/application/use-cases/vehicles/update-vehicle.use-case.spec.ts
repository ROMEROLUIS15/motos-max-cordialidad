import { UpdateVehicleUseCase } from './update-vehicle.use-case';
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
    'CHS1',
    150,
    'Gasolina',
    1000,
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
    save: jest.fn().mockResolvedValue(undefined),
  };
  const useCase = new UpdateVehicleUseCase(vehicleRepo as never);
  return { useCase, vehicleRepo };
}

describe('UpdateVehicleUseCase', () => {
  it('throws NotFoundException when the vehicle does not exist for the tenant', async () => {
    const { useCase, vehicleRepo } = make();
    vehicleRepo.findById.mockResolvedValue(null);
    await expect(
      useCase.execute({ vehicleId: 'veh-1', tenantId: 'tenant-1', brand: 'Honda' }),
    ).rejects.toMatchObject({
      status: 404,
    });
  });

  it('updates only the provided fields', async () => {
    const { useCase, vehicleRepo } = make();
    await useCase.execute({
      vehicleId: 'veh-1',
      tenantId: 'tenant-1',
      brand: 'Honda',
      color: 'Azul',
    });
    const saved = vehicleRepo.save.mock.calls[0][0] as Vehicle;
    expect(saved.brand).toBe('Honda');
    expect(saved.color).toBe('Azul');
    expect(saved.model).toBe('FZ');
  });

  it('clears a nullable field (e.g. chassisNumber) when explicitly set to null', async () => {
    const { useCase, vehicleRepo } = make();
    await useCase.execute({ vehicleId: 'veh-1', tenantId: 'tenant-1', chassisNumber: null });
    const saved = vehicleRepo.save.mock.calls[0][0] as Vehicle;
    expect(saved.chassisNumber).toBeNull();
  });
});
