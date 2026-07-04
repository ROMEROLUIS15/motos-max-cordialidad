import { Module } from '@nestjs/common';
import { PrismaModule } from './infrastructure/persistence/prisma/prisma.module';
import { IdentityModule } from './identity.module';
import { CustomersModule } from './customers.module';

import { VEHICLE_REPOSITORY } from './domain/repositories/vehicle.repository';
import { WORK_ORDER_REPOSITORY } from './domain/repositories/work-order.repository';
import { VEHICLE_OWNERSHIP_HISTORY_REPOSITORY } from './domain/repositories/vehicle-ownership-history.repository';
import { VehiclePrismaRepository } from './infrastructure/persistence/prisma/repositories/vehicle.prisma-repository';
import { WorkOrderPrismaRepository } from './infrastructure/persistence/prisma/repositories/work-order.prisma-repository';
import { VehicleOwnershipHistoryPrismaRepository } from './infrastructure/persistence/prisma/repositories/vehicle-ownership-history.prisma-repository';

import { RegisterVehicleUseCase } from './application/use-cases/vehicles/register-vehicle.use-case';
import { UpdateVehicleUseCase } from './application/use-cases/vehicles/update-vehicle.use-case';
import { DeactivateVehicleUseCase } from './application/use-cases/vehicles/deactivate-vehicle.use-case';
import { TransferVehicleOwnershipUseCase } from './application/use-cases/vehicles/transfer-vehicle-ownership.use-case';
import { GetVehicleHistoryUseCase } from './application/use-cases/vehicles/get-vehicle-history.use-case';

import { VehiclesController } from './presentation/http/controllers/vehicles.controller';

@Module({
  imports: [PrismaModule, IdentityModule, CustomersModule],
  controllers: [VehiclesController],
  providers: [
    { provide: VEHICLE_REPOSITORY, useClass: VehiclePrismaRepository },
    // WORK_ORDER_REPOSITORY canonically lives in WorkshopModule, but Workshop
    // imports this module, so importing it back would be circular — bind it
    // locally instead (WorkOrderPrismaRepository is stateless).
    { provide: WORK_ORDER_REPOSITORY, useClass: WorkOrderPrismaRepository },
    {
      provide: VEHICLE_OWNERSHIP_HISTORY_REPOSITORY,
      useClass: VehicleOwnershipHistoryPrismaRepository,
    },
    RegisterVehicleUseCase,
    UpdateVehicleUseCase,
    DeactivateVehicleUseCase,
    TransferVehicleOwnershipUseCase,
    GetVehicleHistoryUseCase,
  ],
  exports: [VEHICLE_REPOSITORY, GetVehicleHistoryUseCase],
})
export class VehiclesModule {}
