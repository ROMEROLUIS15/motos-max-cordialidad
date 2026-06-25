import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { VehicleRepository } from '../../../../domain/repositories/vehicle.repository';
import { Vehicle } from '../../../../domain/entities/vehicle.entity';

@Injectable()
export class VehiclePrismaRepository implements VehicleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, tenantId: string): Promise<Vehicle | null> {
    const r = await this.prisma.vehicle.findFirst({ where: { id, tenantId, deletedAt: null } });
    return r ? this.toDomain(r) : null;
  }

  async findByPlate(plate: string, tenantId: string): Promise<Vehicle | null> {
    const r = await this.prisma.vehicle.findFirst({ where: { plate, tenantId, deletedAt: null } });
    return r ? this.toDomain(r) : null;
  }

  async findByCustomer(customerId: string, tenantId: string): Promise<Vehicle[]> {
    const records = await this.prisma.vehicle.findMany({
      where: { currentOwnerId: customerId, tenantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async hasActiveWorkOrder(vehicleId: string, tenantId: string): Promise<boolean> {
    const count = await this.prisma.workOrder.count({
      where: {
        vehicleId, tenantId, deletedAt: null,
        status: { in: ['PENDING', 'IN_PROGRESS', 'WAITING_PARTS'] },
      },
    });
    return count > 0;
  }

  async save(vehicle: Vehicle): Promise<void> {
    await this.prisma.vehicle.update({
      where: { id: vehicle.id },
      data: {
        plate: vehicle.plate, brand: vehicle.brand, model: vehicle.model,
        year: vehicle.year, color: vehicle.color, engineNumber: vehicle.engineNumber,
        chassisNumber: vehicle.chassisNumber, displacement: vehicle.displacement,
        fuelType: vehicle.fuelType, currentOdometer: vehicle.currentOdometer,
        observations: vehicle.observations, currentOwnerId: vehicle.currentOwnerId,
        deletedAt: vehicle.deletedAt, updatedAt: vehicle.updatedAt,
      },
    });
  }

  async create(vehicle: Vehicle): Promise<void> {
    await this.prisma.vehicle.create({
      data: {
        id: vehicle.id, tenantId: vehicle.tenantId, plate: vehicle.plate,
        brand: vehicle.brand, model: vehicle.model, year: vehicle.year,
        color: vehicle.color, engineNumber: vehicle.engineNumber,
        chassisNumber: vehicle.chassisNumber, displacement: vehicle.displacement,
        fuelType: vehicle.fuelType, currentOdometer: vehicle.currentOdometer,
        observations: vehicle.observations, currentOwnerId: vehicle.currentOwnerId,
        deletedAt: vehicle.deletedAt, createdAt: vehicle.createdAt, updatedAt: vehicle.updatedAt,
      },
    });
  }

  private toDomain(r: {
    id: string; tenantId: string; plate: string; brand: string; model: string;
    year: number; color: string; engineNumber: string; chassisNumber: string | null;
    displacement: number | null; fuelType: string | null; currentOdometer: number | null;
    observations: string | null; currentOwnerId: string;
    deletedAt: Date | null; createdAt: Date; updatedAt: Date;
  }): Vehicle {
    return new Vehicle(
      r.id, r.tenantId, r.plate, r.brand, r.model, r.year, r.color,
      r.engineNumber, r.chassisNumber, r.displacement, r.fuelType,
      r.currentOdometer, r.observations, r.currentOwnerId, r.deletedAt,
      r.createdAt, r.updatedAt,
    );
  }
}
