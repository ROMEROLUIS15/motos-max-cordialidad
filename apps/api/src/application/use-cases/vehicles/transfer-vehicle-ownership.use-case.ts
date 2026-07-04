import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  VehicleRepository,
  VEHICLE_REPOSITORY,
} from '../../../domain/repositories/vehicle.repository';
import {
  CustomerRepository,
  CUSTOMER_REPOSITORY,
} from '../../../domain/repositories/customer.repository';
import {
  VehicleOwnershipHistoryRepository,
  VEHICLE_OWNERSHIP_HISTORY_REPOSITORY,
} from '../../../domain/repositories/vehicle-ownership-history.repository';

export interface TransferVehicleOwnershipInput {
  vehicleId: string;
  tenantId: string;
  newOwnerId: string;
  transferredBy: string;
}

@Injectable()
export class TransferVehicleOwnershipUseCase {
  constructor(
    @Inject(VEHICLE_REPOSITORY) private readonly vehicleRepo: VehicleRepository,
    @Inject(CUSTOMER_REPOSITORY) private readonly customerRepo: CustomerRepository,
    @Inject(VEHICLE_OWNERSHIP_HISTORY_REPOSITORY)
    private readonly ownershipHistory: VehicleOwnershipHistoryRepository,
  ) {}

  async execute(input: TransferVehicleOwnershipInput): Promise<void> {
    const vehicle = await this.vehicleRepo.findById(input.vehicleId, input.tenantId);
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const newOwner = await this.customerRepo.findById(input.newOwnerId, input.tenantId);
    if (!newOwner) throw new NotFoundException('New owner (customer) not found');

    const previousOwnerId = vehicle.currentOwnerId;

    await this.ownershipHistory.create({
      vehicleId: vehicle.id,
      previousOwner: previousOwnerId,
      newOwner: input.newOwnerId,
      transferredAt: new Date(),
      transferredBy: input.transferredBy,
    });

    vehicle.transferOwnership(input.newOwnerId);
    await this.vehicleRepo.save(vehicle);
  }
}
