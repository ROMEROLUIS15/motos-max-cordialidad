import { Module } from '@nestjs/common';
import { PrismaModule } from './infrastructure/persistence/prisma/prisma.module';
import { IdentityModule } from './identity.module';
import { WorkshopModule } from './workshop.module';
import { CommerceModule } from './commerce.module';
import { InventoryModule } from './inventory.module';
import { MessagingModule } from './messaging.module';
import { NotificationsModule } from './notifications.module';

import { GetDashboardSummaryUseCase } from './application/use-cases/dashboard/get-dashboard-summary.use-case';
import { DeliveryAlertsScheduler } from './application/use-cases/dashboard/delivery-alerts.scheduler';
import { DashboardController } from './presentation/http/controllers/dashboard.controller';
import { HealthController } from './presentation/http/controllers/health.controller';

@Module({
  imports: [
    PrismaModule,
    IdentityModule,
    WorkshopModule,
    CommerceModule,
    InventoryModule,
    MessagingModule,
    NotificationsModule,
  ],
  controllers: [DashboardController, HealthController],
  providers: [GetDashboardSummaryUseCase, DeliveryAlertsScheduler],
})
export class DashboardModule {}
