import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { VehicleReceptionRepository } from '../../../../domain/repositories/vehicle-reception.repository';
import {
  VehicleReception,
  ReceptionPhotoData,
} from '../../../../domain/entities/vehicle-reception.entity';
import { FuelLevel } from '../../../../domain/value-objects/fuel-level.vo';

@Injectable()
export class VehicleReceptionPrismaRepository implements VehicleReceptionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(reception: VehicleReception): Promise<void> {
    await this.prisma.vehicleReception.create({
      data: {
        id: reception.id,
        tenantId: reception.tenantId,
        branchId: reception.branchId,
        vehicleId: reception.vehicleId,
        customerId: reception.customerId,
        receivedAt: reception.receivedAt,
        receivedBy: reception.receivedBy,
        odometerReading: reception.odometerReading,
        fuelLevel: reception.fuelLevel,
        observations: reception.observations,
        visibleDamageNotes: reception.visibleDamageNotes,
        createdAt: reception.createdAt,
      },
    });
  }

  async findById(id: string, tenantId: string): Promise<VehicleReception | null> {
    const r = await this.prisma.vehicleReception.findFirst({
      where: { id, tenantId },
      include: { photos: { orderBy: { createdAt: 'asc' } } },
    });
    if (!r) return null;
    return new VehicleReception(
      r.id,
      r.tenantId,
      r.branchId,
      r.vehicleId,
      r.customerId,
      r.receivedAt,
      r.receivedBy,
      r.odometerReading,
      r.fuelLevel as FuelLevel,
      r.observations,
      r.visibleDamageNotes,
      r.createdAt,
      r.photos.map((p) => ({
        id: p.id,
        receptionId: p.receptionId,
        r2Key: p.r2Key,
        filename: p.filename,
        sizeBytes: p.sizeBytes,
        createdAt: p.createdAt,
      })),
    );
  }

  async addPhoto(receptionId: string, photo: ReceptionPhotoData): Promise<void> {
    await this.prisma.receptionPhoto.create({
      data: {
        id: photo.id,
        receptionId,
        r2Key: photo.r2Key,
        filename: photo.filename,
        sizeBytes: photo.sizeBytes,
        createdAt: photo.createdAt,
      },
    });
  }

  async deletePhoto(receptionId: string, photoId: string): Promise<void> {
    await this.prisma.receptionPhoto.deleteMany({ where: { id: photoId, receptionId } });
  }

  async countPhotos(receptionId: string): Promise<number> {
    return this.prisma.receptionPhoto.count({ where: { receptionId } });
  }
}
