import { Module } from '@nestjs/common';
import { PrismaModule } from './infrastructure/persistence/prisma/prisma.module';
import { IdentityModule } from './identity.module';
import { CustomersModule } from './customers.module';

import { VEHICLE_REPOSITORY } from './domain/repositories/vehicle.repository';
import { VehiclePrismaRepository } from './infrastructure/persistence/prisma/repositories/vehicle.prisma-repository';

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
    RegisterVehicleUseCase,
    UpdateVehicleUseCase,
    DeactivateVehicleUseCase,
    TransferVehicleOwnershipUseCase,
    GetVehicleHistoryUseCase,
  ],
  exports: [VEHICLE_REPOSITORY, GetVehicleHistoryUseCase],
})
export class VehiclesModule {}
