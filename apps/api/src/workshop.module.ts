import { Module } from '@nestjs/common';
import { PrismaModule } from './infrastructure/persistence/prisma/prisma.module';
import { IdentityModule } from './identity.module';
import { VehiclesModule } from './vehicles.module';
import { InventoryModule } from './inventory.module';
import { MessagingModule } from './messaging.module';
import { NotificationsModule } from './notifications.module';
import { StorageModule } from './storage.module';

// Repository tokens + implementations
import { VEHICLE_RECEPTION_REPOSITORY } from './domain/repositories/vehicle-reception.repository';
import { WORK_ORDER_REPOSITORY } from './domain/repositories/work-order.repository';
import { PHOTO_EVIDENCE_REPOSITORY } from './domain/repositories/photo-evidence.repository';
import { VehicleReceptionPrismaRepository } from './infrastructure/persistence/prisma/repositories/vehicle-reception.prisma-repository';
import { WorkOrderPrismaRepository } from './infrastructure/persistence/prisma/repositories/work-order.prisma-repository';
import { PhotoEvidencePrismaRepository } from './infrastructure/persistence/prisma/repositories/photo-evidence.prisma-repository';

// Use cases
import { CreateVehicleReceptionUseCase } from './application/use-cases/workshop/create-vehicle-reception.use-case';
import { AddReceptionPhotoUseCase } from './application/use-cases/workshop/add-reception-photo.use-case';
import {
  GetReceptionUseCase,
  DeleteReceptionPhotoUseCase,
} from './application/use-cases/workshop/get-reception.use-case';
import { CreateWorkOrderUseCase } from './application/use-cases/workshop/create-work-order.use-case';
import { TransitionWorkOrderStatusUseCase } from './application/use-cases/workshop/transition-work-order-status.use-case';
import {
  GetWorkOrderDetailUseCase,
  ListWorkOrdersUseCase,
} from './application/use-cases/workshop/query-work-orders.use-case';
import {
  UpdateWorkOrderUseCase,
  DeleteWorkOrderUseCase,
} from './application/use-cases/workshop/mutate-work-order.use-case';
import {
  AddServiceLineUseCase,
  UpdateServiceLineUseCase,
  RemoveServiceLineUseCase,
} from './application/use-cases/workshop/work-order-lines.use-case';
import {
  AddPartToWorkOrderUseCase,
  RemovePartFromWorkOrderUseCase,
} from './application/use-cases/workshop/work-order-parts.use-case';
import {
  UploadPhotoEvidenceUseCase,
  DeletePhotoEvidenceUseCase,
  GetPhotoEvidenceUrlsUseCase,
} from './application/use-cases/workshop/photo-evidence.use-case';

// Controllers
import { ReceptionsController } from './presentation/http/controllers/receptions.controller';
import { WorkOrdersController } from './presentation/http/controllers/work-orders.controller';

@Module({
  imports: [
    PrismaModule,
    IdentityModule,
    VehiclesModule,
    InventoryModule,
    MessagingModule,
    NotificationsModule,
    StorageModule,
  ],
  controllers: [ReceptionsController, WorkOrdersController],
  providers: [
    { provide: VEHICLE_RECEPTION_REPOSITORY, useClass: VehicleReceptionPrismaRepository },
    { provide: WORK_ORDER_REPOSITORY, useClass: WorkOrderPrismaRepository },
    { provide: PHOTO_EVIDENCE_REPOSITORY, useClass: PhotoEvidencePrismaRepository },
    // STORAGE_PORT/ImageProcessorService from StorageModule; INVENTORY_PORT (Epic 5),
    // MESSAGING_PORT (Epic 7), NOTIFICATION_PORT (Epic 8) from their dedicated modules.
    // Use cases
    CreateVehicleReceptionUseCase,
    AddReceptionPhotoUseCase,
    GetReceptionUseCase,
    DeleteReceptionPhotoUseCase,
    CreateWorkOrderUseCase,
    TransitionWorkOrderStatusUseCase,
    GetWorkOrderDetailUseCase,
    ListWorkOrdersUseCase,
    UpdateWorkOrderUseCase,
    DeleteWorkOrderUseCase,
    AddServiceLineUseCase,
    UpdateServiceLineUseCase,
    RemoveServiceLineUseCase,
    AddPartToWorkOrderUseCase,
    RemovePartFromWorkOrderUseCase,
    UploadPhotoEvidenceUseCase,
    DeletePhotoEvidenceUseCase,
    GetPhotoEvidenceUrlsUseCase,
  ],
  exports: [
    WORK_ORDER_REPOSITORY,
    TransitionWorkOrderStatusUseCase,
    GetWorkOrderDetailUseCase,
  ],
})
export class WorkshopModule {}
