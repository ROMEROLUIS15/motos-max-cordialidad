import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service';
import {
  VehicleOwnershipHistoryRepository,
  VehicleOwnershipHistoryRecord,
} from '../../../../domain/repositories/vehicle-ownership-history.repository';

@Injectable()
export class VehicleOwnershipHistoryPrismaRepository implements VehicleOwnershipHistoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(entry: Omit<VehicleOwnershipHistoryRecord, 'id'>): Promise<void> {
    await this.prisma.vehicleOwnershipHistory.create({
      data: {
        id: randomUUID(),
        vehicleId: entry.vehicleId,
        previousOwner: entry.previousOwner,
        newOwner: entry.newOwner,
        transferredAt: entry.transferredAt,
        transferredBy: entry.transferredBy,
      },
    });
  }

  async findByVehicle(vehicleId: string): Promise<VehicleOwnershipHistoryRecord[]> {
    const rows = await this.prisma.vehicleOwnershipHistory.findMany({
      where: { vehicleId },
      orderBy: { transferredAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      vehicleId: r.vehicleId,
      previousOwner: r.previousOwner,
      newOwner: r.newOwner,
      transferredAt: r.transferredAt,
      transferredBy: r.transferredBy,
    }));
  }
}
