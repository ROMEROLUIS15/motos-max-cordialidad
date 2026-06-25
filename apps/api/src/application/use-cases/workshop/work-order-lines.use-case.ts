import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  WorkOrderRepository,
  WORK_ORDER_REPOSITORY,
  WorkOrderLineRecord,
} from '../../../domain/repositories/work-order.repository';

export interface AddServiceLineInput {
  tenantId: string;
  workOrderId: string;
  description: string;
  unitPrice: number;
  estimatedHours?: number;
  technicianId?: string;
  serviceCatalogId?: string;
}

@Injectable()
export class AddServiceLineUseCase {
  constructor(
    @Inject(WORK_ORDER_REPOSITORY) private readonly workOrderRepo: WorkOrderRepository,
  ) {}

  async execute(input: AddServiceLineInput): Promise<WorkOrderLineRecord> {
    const workOrder = await this.workOrderRepo.findById(input.workOrderId, input.tenantId);
    if (!workOrder) throw new NotFoundException('Orden de trabajo no encontrada');

    const line: WorkOrderLineRecord = {
      id: randomUUID(),
      workOrderId: input.workOrderId,
      description: input.description,
      estimatedHours: input.estimatedHours ?? null,
      unitPrice: input.unitPrice,
      technicianId: input.technicianId ?? null,
      serviceCatalogId: input.serviceCatalogId ?? null,
    };
    await this.workOrderRepo.addLine(line);
    return line;
  }
}

export interface UpdateServiceLineInput {
  tenantId: string;
  workOrderId: string;
  lineId: string;
  description?: string;
  unitPrice?: number;
  estimatedHours?: number | null;
  technicianId?: string | null;
}

@Injectable()
export class UpdateServiceLineUseCase {
  constructor(
    @Inject(WORK_ORDER_REPOSITORY) private readonly workOrderRepo: WorkOrderRepository,
  ) {}

  async execute(input: UpdateServiceLineInput): Promise<WorkOrderLineRecord> {
    const workOrder = await this.workOrderRepo.findById(input.workOrderId, input.tenantId);
    if (!workOrder) throw new NotFoundException('Orden de trabajo no encontrada');

    const line = await this.workOrderRepo.findLineById(input.lineId, input.workOrderId);
    if (!line) throw new NotFoundException('Línea de servicio no encontrada');

    if (input.description !== undefined) line.description = input.description;
    if (input.unitPrice !== undefined) line.unitPrice = input.unitPrice;
    if (input.estimatedHours !== undefined) line.estimatedHours = input.estimatedHours;
    if (input.technicianId !== undefined) line.technicianId = input.technicianId;

    await this.workOrderRepo.updateLine(line);
    return line;
  }
}

@Injectable()
export class RemoveServiceLineUseCase {
  constructor(
    @Inject(WORK_ORDER_REPOSITORY) private readonly workOrderRepo: WorkOrderRepository,
  ) {}

  async execute(workOrderId: string, lineId: string, tenantId: string): Promise<void> {
    const workOrder = await this.workOrderRepo.findById(workOrderId, tenantId);
    if (!workOrder) throw new NotFoundException('Orden de trabajo no encontrada');
    await this.workOrderRepo.removeLine(lineId, workOrderId);
  }
}
