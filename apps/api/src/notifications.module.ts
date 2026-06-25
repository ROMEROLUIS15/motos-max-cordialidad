import { Module } from '@nestjs/common';
import { PrismaModule } from './infrastructure/persistence/prisma/prisma.module';
import { IdentityModule } from './identity.module';

import { NOTIFICATION_REPOSITORY } from './domain/repositories/notification.repository';
import { NotificationPrismaRepository } from './infrastructure/persistence/prisma/repositories/notification.prisma-repository';
import { NOTIFICATION_PORT } from './application/ports/notification.port';
import { NotificationAdapter } from './infrastructure/notifications/notification.adapter';
import { NotificationsGateway } from './infrastructure/notifications/notifications.gateway';

import {
  GetNotificationHistoryUseCase,
  GetUnreadCountUseCase,
  MarkNotificationAsReadUseCase,
  MarkAllNotificationsReadUseCase,
} from './application/use-cases/notifications/notifications.use-cases';
import { NotificationsController } from './presentation/http/controllers/notifications.controller';

/**
 * Real-time notifications: persistence + WebSocket gateway. Provides the real
 * NOTIFICATION_PORT (replaces NotificationStubAdapter). Depends only on Prisma
 * and Identity (for JWT verification on socket connect), so no dependency
 * cycles with the feature modules that emit notifications.
 */
@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [NotificationsController],
  providers: [
    { provide: NOTIFICATION_REPOSITORY, useClass: NotificationPrismaRepository },
    NotificationsGateway,
    { provide: NOTIFICATION_PORT, useClass: NotificationAdapter },
    GetNotificationHistoryUseCase,
    GetUnreadCountUseCase,
    MarkNotificationAsReadUseCase,
    MarkAllNotificationsReadUseCase,
  ],
  exports: [NOTIFICATION_PORT, NOTIFICATION_REPOSITORY],
})
export class NotificationsModule {}
