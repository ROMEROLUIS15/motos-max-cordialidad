import { RegisterVehicleUseCase } from './register-vehicle.use-case';

function make() {
  const vehicleRepo = {
    findByPlate: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(undefined),
  };
  const customerRepo = { findById: jest.fn().mockResolvedValue({ id: 'cust-1' }) };
  const useCase = new RegisterVehicleUseCase(vehicleRepo as never, customerRepo as never);
  return { useCase, vehicleRepo, customerRepo };
}

const baseInput = {
  tenantId: 'tenant-1',
  plate: 'ABC123',
  brand: 'Yamaha',
  model: 'FZ',
  color: 'Rojo',
  engineNumber: 'ENG1',
  currentOwnerId: 'cust-1',
};

describe('RegisterVehicleUseCase', () => {
  it('throws NotFoundException when the owner customer does not exist', async () => {
    const { useCase, customerRepo } = make();
    customerRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute(baseInput)).rejects.toMatchObject({ status: 404 });
  });

  it('throws ConflictException when the plate is already registered for the tenant', async () => {
    const { useCase, vehicleRepo } = make();
    vehicleRepo.findByPlate.mockResolvedValue({ id: 'existing' });
    await expect(useCase.execute(baseInput)).rejects.toMatchObject({ status: 409 });
  });

  it('creates the vehicle with null defaults for optional fields', async () => {
    const { useCase, vehicleRepo } = make();
    const vehicle = await useCase.execute(baseInput);

    expect(vehicle.year).toBeNull();
    expect(vehicle.chassisNumber).toBeNull();
    expect(vehicle.displacement).toBeNull();
    expect(vehicle.currentOwnerId).toBe('cust-1');
    expect(vehicleRepo.create).toHaveBeenCalledWith(vehicle);
  });

  it('carries through optional fields when provided', async () => {
    const { useCase } = make();
    const vehicle = await useCase.execute({
      ...baseInput,
      year: 2024,
      chassisNumber: 'CHS1',
      displacement: 150,
      fuelType: 'Gasolina',
      currentOdometer: 1200,
      observations: 'Ninguna',
    });
    expect(vehicle.year).toBe(2024);
    expect(vehicle.chassisNumber).toBe('CHS1');
    expect(vehicle.currentOdometer).toBe(1200);
  });
});
