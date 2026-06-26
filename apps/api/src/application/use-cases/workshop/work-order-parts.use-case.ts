import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  WorkOrderRepository,
  WORK_ORDER_REPOSITORY,
  WorkOrderPartRecord,
} from '../../../domain/repositories/work-order.repository';
import { InventoryPort, INVENTORY_PORT } from '../../ports/inventory.port';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

export interface AddPartToWorkOrderInput {
  tenantId: string;
  workOrderId: string;
  partId: string;
  quantity: number;
}

@Injectable()
export class AddPartToWorkOrderUseCase {
  constructor(
    @Inject(WORK_ORDER_REPOSITORY) private readonly workOrderRepo: WorkOrderRepository,
    @Inject(INVENTORY_PORT) private readonly inventoryPort: InventoryPort,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: AddPartToWorkOrderInput): Promise<WorkOrderPartRecord> {
    const workOrder = await this.workOrderRepo.findById(input.workOrderId, input.tenantId);
    if (!workOrder) throw new NotFoundException('Orden de trabajo no encontrada');

    const part = await this.prisma.part.findFirst({
      where: { id: input.partId, tenantId: input.tenantId },
      select: { salePrice: true, name: true, sku: true },
    });
    if (!part) throw new NotFoundException('Repuesto no encontrado');

    // Reserves stock; throws InsufficientStockException if not enough available.
    await this.inventoryPort.reserveStock(
      input.partId,
      workOrder.branchId,
      input.quantity,
      input.tenantId,
    );

    const record: WorkOrderPartRecord = {
      id: randomUUID(),
      workOrderId: input.workOrderId,
      partId: input.partId,
      partName: part.name,
      partSku: part.sku,
      quantity: input.quantity,
      unitPriceAtSale: Number(part.salePrice),
    };
    await this.workOrderRepo.addPart(record);
    return record;
  }
}

@Injectable()
export class RemovePartFromWorkOrderUseCase {
  constructor(
    @Inject(WORK_ORDER_REPOSITORY) private readonly workOrderRepo: WorkOrderRepository,
    @Inject(INVENTORY_PORT) private readonly inventoryPort: InventoryPort,
  ) {}

  async execute(workOrderId: string, partRecordId: string, tenantId: string): Promise<void> {
    const workOrder = await this.workOrderRepo.findById(workOrderId, tenantId);
    if (!workOrder) throw new NotFoundException('Orden de trabajo no encontrada');

    const record = await this.workOrderRepo.findPartById(partRecordId, workOrderId);
    if (!record) throw new NotFoundException('Repuesto de la orden no encontrado');

    await this.inventoryPort.releaseReservation(
      record.partId,
      workOrder.branchId,
      record.quantity,
      tenantId,
    );
    await this.workOrderRepo.removePart(partRecordId, workOrderId);
  }
}
