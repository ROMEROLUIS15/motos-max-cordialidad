import { TransferVehicleOwnershipUseCase } from './transfer-vehicle-ownership.use-case';
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
    'cust-old',
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
  const customerRepo = { findById: jest.fn().mockResolvedValue({ id: 'cust-new' }) };
  const ownershipHistory = { create: jest.fn().mockResolvedValue(undefined) };
  const useCase = new TransferVehicleOwnershipUseCase(
    vehicleRepo as never,
    customerRepo as never,
    ownershipHistory as never,
  );
  return { useCase, vehicleRepo, customerRepo, ownershipHistory };
}

const baseInput = {
  vehicleId: 'veh-1',
  tenantId: 'tenant-1',
  newOwnerId: 'cust-new',
  transferredBy: 'user-1',
};

describe('TransferVehicleOwnershipUseCase', () => {
  it('throws NotFoundException when the vehicle does not exist for the tenant', async () => {
    const { useCase, vehicleRepo } = make();
    vehicleRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute(baseInput)).rejects.toMatchObject({ status: 404 });
  });

  it('throws NotFoundException when the new owner does not exist', async () => {
    const { useCase, customerRepo } = make();
    customerRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute(baseInput)).rejects.toMatchObject({ status: 404 });
  });

  it('records the ownership history with the previous and new owner, then transfers and saves', async () => {
    const { useCase, vehicleRepo, ownershipHistory } = make();
    await useCase.execute(baseInput);

    expect(ownershipHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        vehicleId: 'veh-1',
        previousOwner: 'cust-old',
        newOwner: 'cust-new',
        transferredBy: 'user-1',
      }),
    );
    const saved = vehicleRepo.save.mock.calls[0][0] as Vehicle;
    expect(saved.currentOwnerId).toBe('cust-new');
  });
});
