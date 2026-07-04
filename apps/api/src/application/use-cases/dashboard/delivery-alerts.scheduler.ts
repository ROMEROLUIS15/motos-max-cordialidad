import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  WorkOrderRepository,
  WORK_ORDER_REPOSITORY,
} from '../../../domain/repositories/work-order.repository';
import { NotificationPort, NOTIFICATION_PORT } from '../../ports/notification.port';
import { MessagingPort, MESSAGING_PORT } from '../../ports/messaging.port';
import {
  TenantRepository,
  TENANT_REPOSITORY,
} from '../../../domain/repositories/tenant.repository';

/**
 * Every 30 minutes, finds work orders within 2h of their promised delivery and
 * notifies OWNER/ADMIN plus the customer via WhatsApp.
 */
@Injectable()
export class DeliveryAlertsScheduler {
  private readonly logger = new Logger(DeliveryAlertsScheduler.name);

  constructor(
    @Inject(WORK_ORDER_REPOSITORY) private readonly workOrderRepo: WorkOrderRepository,
    @Inject(NOTIFICATION_PORT) private readonly notification: NotificationPort,
    @Inject(MESSAGING_PORT) private readonly messaging: MessagingPort,
    @Inject(TENANT_REPOSITORY) private readonly tenantRepo: TenantRepository,
  ) {}

  @Cron('*/30 * * * *')
  async handle(): Promise<void> {
    try {
      const tenants = await this.tenantRepo.findActive();
      for (const { id: tenantId } of tenants) {
        const orders = await this.workOrderRepo.findNearingDeadline(2, tenantId);
        for (const wo of orders) {
          await this.notification.notifyAdmins(tenantId, {
            type: 'WORK_ORDER_NEAR_DEADLINE',
            workOrderId: wo.id,
          });
          await this.messaging
            .sendManualMessage(
              wo.customerId,
              `Recordatorio: tu orden ${wo.orderNumber} está próxima a su entrega.`,
              tenantId,
            )
            .catch(() => undefined);
        }
      }
    } catch (error) {
      this.logger.error('DeliveryAlerts job failed', error as Error);
    }
  }
}
