import { Inject, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { VehicleRepository, VEHICLE_REPOSITORY } from '../../../domain/repositories/vehicle.repository';

@Injectable()
export class DeactivateVehicleUseCase {
  constructor(@Inject(VEHICLE_REPOSITORY) private readonly vehicleRepo: VehicleRepository) {}

  async execute(vehicleId: string, tenantId: string): Promise<void> {
    const vehicle = await this.vehicleRepo.findById(vehicleId, tenantId);
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const hasActive = await this.vehicleRepo.hasActiveWorkOrder(vehicleId, tenantId);
    if (hasActive) throw new ConflictException('Cannot deactivate vehicle with active work orders');

    vehicle.deactivate();
    await this.vehicleRepo.save(vehicle);
  }
}
