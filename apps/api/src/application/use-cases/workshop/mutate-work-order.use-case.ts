import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  WorkOrderRepository,
  WORK_ORDER_REPOSITORY,
} from '../../../domain/repositories/work-order.repository';

export interface UpdateWorkOrderInput {
  tenantId: string;
  workOrderId: string;
  technicianId?: string;
  serviceType?: string;
  problemDescription?: string;
}

@Injectable()
export class UpdateWorkOrderUseCase {
  constructor(
    @Inject(WORK_ORDER_REPOSITORY) private readonly workOrderRepo: WorkOrderRepository,
  ) {}

  async execute(input: UpdateWorkOrderInput): Promise<void> {
    const workOrder = await this.workOrderRepo.findById(input.workOrderId, input.tenantId);
    if (!workOrder) throw new NotFoundException('Orden de trabajo no encontrada');

    if (input.technicianId !== undefined) workOrder.reassignTechnician(input.technicianId);
    if (input.serviceType !== undefined) workOrder.serviceType = input.serviceType;
    if (input.problemDescription !== undefined) workOrder.problemDescription = input.problemDescription;

    await this.workOrderRepo.save(workOrder);
  }
}

@Injectable()
export class DeleteWorkOrderUseCase {
  constructor(
    @Inject(WORK_ORDER_REPOSITORY) private readonly workOrderRepo: WorkOrderRepository,
  ) {}

  async execute(workOrderId: string, tenantId: string): Promise<void> {
    const workOrder = await this.workOrderRepo.findById(workOrderId, tenantId);
    if (!workOrder) throw new NotFoundException('Orden de trabajo no encontrada');
    workOrder.softDelete();
    await this.workOrderRepo.save(workOrder);
  }
}
