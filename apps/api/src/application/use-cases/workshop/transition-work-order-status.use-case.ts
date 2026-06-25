import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { WorkOrderStatus } from '../../../domain/value-objects/work-order-status.vo';
import {
  WorkOrderRepository,
  WORK_ORDER_REPOSITORY,
} from '../../../domain/repositories/work-order.repository';
import { InventoryPort, INVENTORY_PORT } from '../../ports/inventory.port';
import { MessagingPort, MESSAGING_PORT } from '../../ports/messaging.port';
import { NotificationPort, NOTIFICATION_PORT } from '../../ports/notification.port';

export interface TransitionWorkOrderStatusInput {
  workOrderId: string;
  newStatus: WorkOrderStatus;
  changedBy: string;
  tenantId: string;
  note?: string;
  finalOdometer?: number;
}

export interface TransitionWorkOrderStatusOutput {
  workOrderId: string;
  previousStatus: WorkOrderStatus;
  newStatus: WorkOrderStatus;
}

@Injectable()
export class TransitionWorkOrderStatusUseCase {
  private readonly logger = new Logger(TransitionWorkOrderStatusUseCase.name);

  constructor(
    @Inject(WORK_ORDER_REPOSITORY) private readonly workOrderRepo: WorkOrderRepository,
    @Inject(INVENTORY_PORT) private readonly inventoryPort: InventoryPort,
    @Inject(MESSAGING_PORT) private readonly messagingPort: MessagingPort,
    @Inject(NOTIFICATION_PORT) private readonly notificationPort: NotificationPort,
  ) {}

  async execute(input: TransitionWorkOrderStatusInput): Promise<TransitionWorkOrderStatusOutput> {
    const workOrder = await this.workOrderRepo.findById(input.workOrderId, input.tenantId);
    if (!workOrder) throw new NotFoundException('Orden de trabajo no encontrada');

    const change = workOrder.transitionTo(input.newStatus);

    // Inventory effects are CRITICAL — failures must roll back the transition.
    if (input.newStatus === WorkOrderStatus.DELIVERED) {
      await this.inventoryPort.confirmStockDiscount(input.workOrderId, input.tenantId);
    }
    if (input.newStatus === WorkOrderStatus.CANCELLED) {
      await this.inventoryPort.releaseAllReservations(input.workOrderId, input.tenantId);
    }
    if (input.newStatus === WorkOrderStatus.COMPLETED && input.finalOdometer) {
      workOrder.setFinalOdometer(input.finalOdometer);
    }

    // Messaging/notifications are BEST-EFFORT — a failure (e.g. Redis/Meta down)
    // must never roll back the status change.
    await this.notifySideEffects(workOrder, input.newStatus);

    await this.workOrderRepo.save(workOrder);
    await this.workOrderRepo.saveStatusHistory({
      workOrderId: workOrder.id,
      previousStatus: change.previousStatus,
      newStatus: change.newStatus,
      changedBy: input.changedBy,
      note: input.note ?? null,
      changedAt: new Date(),
    });

    return { workOrderId: workOrder.id, ...change };
  }

  /** Best-effort WhatsApp + admin notifications; never throws. */
  private async notifySideEffects(
    workOrder: {
      id: string;
      customerId: string;
      vehicleId: string;
      orderNumber: string;
      tenantId: string;
      promisedDeliveryAt: Date;
    },
    newStatus: WorkOrderStatus,
  ): Promise<void> {
    try {
      if (newStatus === WorkOrderStatus.COMPLETED) {
        await this.messagingPort.sendWorkOrderCompletedNotification({
          id: workOrder.id,
          customerId: workOrder.customerId,
          vehicleId: workOrder.vehicleId,
          orderNumber: workOrder.orderNumber,
          tenantId: workOrder.tenantId,
        });
        await this.notificationPort.notifyAdmins(workOrder.tenantId, {
          type: 'WORK_ORDER_COMPLETED',
          workOrderId: workOrder.id,
        });
      }
      if (newStatus === WorkOrderStatus.WAITING_PARTS) {
        await this.messagingPort.sendWaitingPartsNotification({
          id: workOrder.id,
          customerId: workOrder.customerId,
          vehicleId: workOrder.vehicleId,
          orderNumber: workOrder.orderNumber,
          tenantId: workOrder.tenantId,
          promisedDeliveryAt: workOrder.promisedDeliveryAt,
        });
      }
    } catch (error) {
      this.logger.warn(`Notification side-effect failed (non-fatal): ${(error as Error).message}`);
    }
  }
}

