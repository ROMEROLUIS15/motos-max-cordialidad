import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { VehicleRepository, VEHICLE_REPOSITORY } from '../../../domain/repositories/vehicle.repository';
import { CustomerRepository, CUSTOMER_REPOSITORY } from '../../../domain/repositories/customer.repository';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

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
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: TransferVehicleOwnershipInput): Promise<void> {
    const vehicle = await this.vehicleRepo.findById(input.vehicleId, input.tenantId);
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const newOwner = await this.customerRepo.findById(input.newOwnerId, input.tenantId);
    if (!newOwner) throw new NotFoundException('New owner (customer) not found');

    const previousOwnerId = vehicle.currentOwnerId;

    await this.prisma.vehicleOwnershipHistory.create({
      data: {
        id: randomUUID(),
        vehicleId: vehicle.id,
        previousOwner: previousOwnerId,
        newOwner: input.newOwnerId,
        transferredAt: new Date(),
        transferredBy: input.transferredBy,
      },
    });

    vehicle.transferOwnership(input.newOwnerId);
    await this.vehicleRepo.save(vehicle);
  }
}
