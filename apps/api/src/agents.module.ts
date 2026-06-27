import { Module } from '@nestjs/common';
import { PrismaModule } from './infrastructure/persistence/prisma/prisma.module';
import { IdentityModule } from './identity.module';
import { WorkshopModule } from './workshop.module';
import { CommerceModule } from './commerce.module';
import { InventoryModule } from './inventory.module';
import { MessagingModule } from './messaging.module';
import { NotificationsModule } from './notifications.module';
import { StorageModule } from './storage.module';

import { TokenFactoryService } from './application/services/token-factory.service';
import { ServiceAuthGuard } from './presentation/http/guards/service-auth.guard';

import { REPORT_REPOSITORY } from './domain/repositories/report.repository';
import { ReportPrismaRepository } from './infrastructure/persistence/prisma/repositories/report.prisma-repository';
import { PURCHASE_ORDER_DRAFT_REPOSITORY } from './domain/repositories/purchase-order-draft.repository';
import { PurchaseOrderDraftPrismaRepository } from './infrastructure/persistence/prisma/repositories/purchase-order-draft.prisma-repository';

import {
  ListActiveTenantsUseCase,
  GetAgentsDashboardSummaryUseCase,
  GetAgentsInventoryStatusUseCase,
  CreatePurchaseOrderDraftUseCase,
  CreateStockAlertUseCase,
  GetPendingWorkOrdersUseCase,
  RecordReportUseCase,
  GenerateReportUseCase,
  SendOwnerWhatsAppUseCase,
  ListReportsUseCase,
  GetReportDownloadUrlUseCase,
} from './application/use-cases/agents/agents.use-cases';
import {
  ListPurchaseOrderDraftsUseCase,
  DecidePurchaseOrderDraftUseCase,
} from './application/use-cases/purchase-orders/purchase-orders.use-cases';
import { AgentsController } from './presentation/http/controllers/agents.controller';
import { ReportsController } from './presentation/http/controllers/reports.controller';
import { PurchaseOrdersController } from './presentation/http/controllers/purchase-orders.controller';

/**
 * Fase 2A — service-to-service surface consumed by the Python agents
 * microservice, plus the web-facing reports controller. Reuses the existing
 * feature modules' repositories (same set DashboardModule depends on).
 */
@Module({
  imports: [
    PrismaModule,
    IdentityModule,
    WorkshopModule,
    CommerceModule,
    InventoryModule,
    MessagingModule,
    NotificationsModule,
    StorageModule,
  ],
  controllers: [AgentsController, ReportsController, PurchaseOrdersController],
  providers: [
    TokenFactoryService,
    ServiceAuthGuard,
    { provide: REPORT_REPOSITORY, useClass: ReportPrismaRepository },
    { provide: PURCHASE_ORDER_DRAFT_REPOSITORY, useClass: PurchaseOrderDraftPrismaRepository },
    ListActiveTenantsUseCase,
    GetAgentsDashboardSummaryUseCase,
    GetAgentsInventoryStatusUseCase,
    CreatePurchaseOrderDraftUseCase,
    CreateStockAlertUseCase,
    GetPendingWorkOrdersUseCase,
    RecordReportUseCase,
    GenerateReportUseCase,
    SendOwnerWhatsAppUseCase,
    ListReportsUseCase,
    GetReportDownloadUrlUseCase,
    ListPurchaseOrderDraftsUseCase,
    DecidePurchaseOrderDraftUseCase,
  ],
  exports: [TokenFactoryService, ServiceAuthGuard],
})
export class AgentsModule {}
