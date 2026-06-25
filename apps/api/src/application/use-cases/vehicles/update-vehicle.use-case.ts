import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { VehicleRepository, VEHICLE_REPOSITORY } from '../../../domain/repositories/vehicle.repository';

export interface UpdateVehicleInput {
  vehicleId: string;
  tenantId: string;
  brand?: string;
  model?: string;
  color?: string;
  engineNumber?: string;
  chassisNumber?: string | null;
  displacement?: number | null;
  fuelType?: string | null;
  observations?: string | null;
}

@Injectable()
export class UpdateVehicleUseCase {
  constructor(@Inject(VEHICLE_REPOSITORY) private readonly vehicleRepo: VehicleRepository) {}

  async execute(input: UpdateVehicleInput): Promise<void> {
    const vehicle = await this.vehicleRepo.findById(input.vehicleId, input.tenantId);
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    if (input.brand !== undefined) vehicle.brand = input.brand;
    if (input.model !== undefined) vehicle.model = input.model;
    if (input.color !== undefined) vehicle.color = input.color;
    if (input.engineNumber !== undefined) vehicle.engineNumber = input.engineNumber;
    if (input.chassisNumber !== undefined) vehicle.chassisNumber = input.chassisNumber;
    if (input.displacement !== undefined) vehicle.displacement = input.displacement;
    if (input.fuelType !== undefined) vehicle.fuelType = input.fuelType;
    if (input.observations !== undefined) vehicle.observations = input.observations;
    vehicle.updatedAt = new Date();

    await this.vehicleRepo.save(vehicle);
  }
}
