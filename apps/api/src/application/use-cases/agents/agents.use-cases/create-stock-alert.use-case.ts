import { Inject, Injectable } from '@nestjs/common';
import {
  NotificationPort,
  NOTIFICATION_PORT,
} from '../../../../application/ports/notification.port';
import {
  NotificationRepository,
  NOTIFICATION_REPOSITORY,
} from '../../../../domain/repositories/notification.repository';

export interface StockAlertInput {
  tenantId: string;
  partId: string;
  partName: string;
  currentStock: number;
  minStock: number;
}

@Injectable()
export class CreateStockAlertUseCase {
  constructor(
    @Inject(NOTIFICATION_PORT) private readonly notifications: NotificationPort,
    @Inject(NOTIFICATION_REPOSITORY) private readonly notificationRepo: NotificationRepository,
  ) {}

  async execute(input: StockAlertInput) {
    const adminIds = await this.notificationRepo.findAdminUserIds(input.tenantId);
    await Promise.all(
      adminIds.map((userId) =>
        this.notifications.notifyUser(userId, {
          type: 'STOCK_ALERT',
          title: `Stock bajo: ${input.partName}`,
          body: `${input.partName} tiene ${input.currentStock} unidades (mínimo ${input.minStock}). Considera reabastecer.`,
          resourceType: 'part',
          resourceId: input.partId,
        }),
      ),
    );
    return { notified: adminIds.length };
  }
}
