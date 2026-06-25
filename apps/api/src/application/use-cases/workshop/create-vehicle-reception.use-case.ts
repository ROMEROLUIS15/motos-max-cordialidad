import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { VehicleReception } from '../../../domain/entities/vehicle-reception.entity';
import { FuelLevel, isFuelLevel } from '../../../domain/value-objects/fuel-level.vo';
import {
  VehicleReceptionRepository,
  VEHICLE_RECEPTION_REPOSITORY,
} from '../../../domain/repositories/vehicle-reception.repository';
import { VehicleRepository, VEHICLE_REPOSITORY } from '../../../domain/repositories/vehicle.repository';

export interface CreateVehicleReceptionInput {
  tenantId: string;
  branchId: string;
  vehicleId: string;
  receivedBy: string;
  odometerReading: number;
  fuelLevel: string;
  observations?: string;
  visibleDamageNotes?: string;
}

@Injectable()
export class CreateVehicleReceptionUseCase {
  constructor(
    @Inject(VEHICLE_RECEPTION_REPOSITORY)
    private readonly receptionRepo: VehicleReceptionRepository,
    @Inject(VEHICLE_REPOSITORY) private readonly vehicleRepo: VehicleRepository,
  ) {}

  async execute(input: CreateVehicleReceptionInput): Promise<VehicleReception> {
    const vehicle = await this.vehicleRepo.findById(input.vehicleId, input.tenantId);
    if (!vehicle) throw new NotFoundException('Vehículo no encontrado');

    if (!isFuelLevel(input.fuelLevel)) {
      throw new UnprocessableEntityException(
        `Nivel de combustible inválido. Valores: ${Object.values(FuelLevel).join(', ')}`,
      );
    }

    const now = new Date();
    const reception = new VehicleReception(
      randomUUID(),
      input.tenantId,
      input.branchId,
      input.vehicleId,
      vehicle.currentOwnerId,
      now,
      input.receivedBy,
      input.odometerReading,
      input.fuelLevel,
      input.observations ?? null,
      input.visibleDamageNotes ?? null,
      now,
      [],
    );
    await this.receptionRepo.create(reception);
    return reception;
  }
}
