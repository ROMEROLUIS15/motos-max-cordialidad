import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { VehicleRepository, VEHICLE_REPOSITORY } from '../../../domain/repositories/vehicle.repository';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

@Injectable()
export class GetVehicleHistoryUseCase {
  constructor(
    @Inject(VEHICLE_REPOSITORY) private readonly vehicleRepo: VehicleRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(vehicleId: string, tenantId: string) {
    const vehicle = await this.vehicleRepo.findById(vehicleId, tenantId);
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const [workOrders, ownershipHistory] = await Promise.all([
      this.prisma.workOrder.findMany({
        where: { vehicleId, tenantId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: {
          parts: { include: { part: true } },
          photoEvidences: { where: { deletedAt: null } },
          lines: true,
        },
      }),
      this.prisma.vehicleOwnershipHistory.findMany({
        where: { vehicleId },
        orderBy: { transferredAt: 'desc' },
      }),
    ]);

    return { vehicle, workOrders, ownershipHistory };
  }
}
