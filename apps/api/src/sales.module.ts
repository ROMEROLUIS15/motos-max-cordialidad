import { Module } from '@nestjs/common';
import { PrismaModule } from './infrastructure/persistence/prisma/prisma.module';
import { IdentityModule } from './identity.module';

import { MOTORCYCLE_UNIT_REPOSITORY } from './domain/repositories/motorcycle-unit.repository';
import { MotorcycleUnitPrismaRepository } from './infrastructure/persistence/prisma/repositories/motorcycle-unit.prisma-repository';

import {
  RegisterMotorcycleUnitUseCase,
  UpdateMotorcycleUnitUseCase,
  ChangeMotorcycleUnitStatusUseCase,
  SearchMotorcycleUnitsUseCase,
  GetMotorcycleUnitDetailUseCase,
} from './application/use-cases/sales/motorcycle-units.use-case';

import { MotorcycleUnitsController } from './presentation/http/controllers/motorcycle-units.controller';

@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [MotorcycleUnitsController],
  providers: [
    { provide: MOTORCYCLE_UNIT_REPOSITORY, useClass: MotorcycleUnitPrismaRepository },
    RegisterMotorcycleUnitUseCase,
    UpdateMotorcycleUnitUseCase,
    ChangeMotorcycleUnitStatusUseCase,
    SearchMotorcycleUnitsUseCase,
    GetMotorcycleUnitDetailUseCase,
  ],
  exports: [MOTORCYCLE_UNIT_REPOSITORY],
})
export class SalesModule {}
