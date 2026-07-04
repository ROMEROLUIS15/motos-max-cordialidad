import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  VehicleRepository,
  VEHICLE_REPOSITORY,
} from '../../../domain/repositories/vehicle.repository';
import {
  WorkOrderRepository,
  WORK_ORDER_REPOSITORY,
} from '../../../domain/repositories/work-order.repository';
import {
  VehicleOwnershipHistoryRepository,
  VEHICLE_OWNERSHIP_HISTORY_REPOSITORY,
} from '../../../domain/repositories/vehicle-ownership-history.repository';

@Injectable()
export class GetVehicleHistoryUseCase {
  constructor(
    @Inject(VEHICLE_REPOSITORY) private readonly vehicleRepo: VehicleRepository,
    @Inject(WORK_ORDER_REPOSITORY) private readonly workOrderRepo: WorkOrderRepository,
    @Inject(VEHICLE_OWNERSHIP_HISTORY_REPOSITORY)
    private readonly ownershipHistoryRepo: VehicleOwnershipHistoryRepository,
  ) {}

  async execute(vehicleId: string, tenantId: string) {
    const vehicle = await this.vehicleRepo.findById(vehicleId, tenantId);
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const [workOrders, ownershipHistory] = await Promise.all([
      this.workOrderRepo.findVehicleServiceHistory(vehicleId, tenantId),
      this.ownershipHistoryRepo.findByVehicle(vehicleId),
    ]);

    return { vehicle, workOrders, ownershipHistory };
  }
}
