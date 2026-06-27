import { Module } from '@nestjs/common';
import { PrismaModule } from './infrastructure/persistence/prisma/prisma.module';
import { IdentityModule } from './identity.module';
import { MessagingModule } from './messaging.module';
import { NotificationsModule } from './notifications.module';

import { HOME_SERVICE_REQUEST_REPOSITORY } from './domain/repositories/home-service-request.repository';
import { HomeServiceRequestPrismaRepository } from './infrastructure/persistence/prisma/repositories/home-service-request.prisma-repository';
import {
  CreateHomeServiceRequestUseCase,
  ListHomeServiceRequestsUseCase,
  AssignHomeServiceRequestUseCase,
  UpdateHomeServiceStatusUseCase,
} from './application/use-cases/home-services/home-services.use-cases';
import { HomeServicesController } from './presentation/http/controllers/home-services.controller';

/**
 * Fase 2A — home-service requests captured by the AI agent or the web.
 * Exports CreateHomeServiceRequestUseCase so AiModule's ToolRegistry can drive
 * the createHomeServiceRequest tool in-process (no self HTTP call).
 * IdentityModule supplies USER_REPOSITORY + the auth guards.
 */
@Module({
  imports: [PrismaModule, IdentityModule, MessagingModule, NotificationsModule],
  controllers: [HomeServicesController],
  providers: [
    { provide: HOME_SERVICE_REQUEST_REPOSITORY, useClass: HomeServiceRequestPrismaRepository },
    CreateHomeServiceRequestUseCase,
    ListHomeServiceRequestsUseCase,
    AssignHomeServiceRequestUseCase,
    UpdateHomeServiceStatusUseCase,
  ],
  exports: [CreateHomeServiceRequestUseCase],
})
export class HomeServicesModule {}
