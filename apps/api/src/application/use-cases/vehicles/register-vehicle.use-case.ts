import { Inject, Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Vehicle } from '../../../domain/entities/vehicle.entity';
import { VehicleRepository, VEHICLE_REPOSITORY } from '../../../domain/repositories/vehicle.repository';
import { CustomerRepository, CUSTOMER_REPOSITORY } from '../../../domain/repositories/customer.repository';

export interface RegisterVehicleInput {
  tenantId: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  color: string;
  engineNumber: string;
  currentOwnerId: string;
  chassisNumber?: string;
  displacement?: number;
  fuelType?: string;
  currentOdometer?: number;
  observations?: string;
}

@Injectable()
export class RegisterVehicleUseCase {
  constructor(
    @Inject(VEHICLE_REPOSITORY) private readonly vehicleRepo: VehicleRepository,
    @Inject(CUSTOMER_REPOSITORY) private readonly customerRepo: CustomerRepository,
  ) {}

  async execute(input: RegisterVehicleInput): Promise<Vehicle> {
    const owner = await this.customerRepo.findById(input.currentOwnerId, input.tenantId);
    if (!owner) throw new NotFoundException('Customer (owner) not found');

    const existing = await this.vehicleRepo.findByPlate(input.plate, input.tenantId);
    if (existing) throw new ConflictException(`Vehicle with plate ${input.plate} already exists`);

    const now = new Date();
    const vehicle = new Vehicle(
      randomUUID(), input.tenantId, input.plate, input.brand, input.model,
      input.year, input.color, input.engineNumber,
      input.chassisNumber ?? null, input.displacement ?? null,
      input.fuelType ?? null, input.currentOdometer ?? null,
      input.observations ?? null, input.currentOwnerId, null, now, now,
    );
    await this.vehicleRepo.create(vehicle);
    return vehicle;
  }
}
