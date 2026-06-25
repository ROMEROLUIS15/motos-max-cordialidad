import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { WorkOrder } from '../../../domain/entities/work-order.entity';
import { WorkOrderStatus } from '../../../domain/value-objects/work-order-status.vo';
import { VehicleHasActiveOrderException } from '../../../domain/exceptions/domain.exception';
import {
  WorkOrderRepository,
  WORK_ORDER_REPOSITORY,
} from '../../../domain/repositories/work-order.repository';
import {
  VehicleReceptionRepository,
  VEHICLE_RECEPTION_REPOSITORY,
} from '../../../domain/repositories/vehicle-reception.repository';
import { VehicleRepository, VEHICLE_REPOSITORY } from '../../../domain/repositories/vehicle.repository';

export interface CreateWorkOrderInput {
  tenantId: string;
  receptionId: string;
  technicianId: string;
  serviceType: string;
  problemDescription: string;
  promisedDeliveryAt: Date;
}

@Injectable()
export class CreateWorkOrderUseCase {
  constructor(
    @Inject(WORK_ORDER_REPOSITORY) private readonly workOrderRepo: WorkOrderRepository,
    @Inject(VEHICLE_RECEPTION_REPOSITORY)
    private readonly receptionRepo: VehicleReceptionRepository,
    @Inject(VEHICLE_REPOSITORY) private readonly vehicleRepo: VehicleRepository,
  ) {}

  async execute(input: CreateWorkOrderInput): Promise<WorkOrder> {
    const reception = await this.receptionRepo.findById(input.receptionId, input.tenantId);
    if (!reception) throw new NotFoundException('Recepción no encontrada');

    const hasActive = await this.vehicleRepo.hasActiveWorkOrder(reception.vehicleId, input.tenantId);
    if (hasActive) throw new VehicleHasActiveOrderException(reception.vehicleId);

    const year = new Date().getFullYear();
    const orderNumber = await this.workOrderRepo.generateOrderNumber(input.tenantId, year);

    const now = new Date();
    const workOrder = new WorkOrder(
      randomUUID(),
      input.tenantId,
      reception.branchId,
      orderNumber,
      reception.id,
      reception.vehicleId,
      reception.customerId,
      input.technicianId,
      input.serviceType,
      input.problemDescription,
      WorkOrderStatus.PENDING,
      input.promisedDeliveryAt,
      null,
      now,
      now,
      null,
    );
    await this.workOrderRepo.create(workOrder);
    return workOrder;
  }
}
