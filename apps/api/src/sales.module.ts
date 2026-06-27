import { Module } from '@nestjs/common';
import { PrismaModule } from './infrastructure/persistence/prisma/prisma.module';
import { IdentityModule } from './identity.module';
import { CustomersModule } from './customers.module';
import { StorageModule } from './storage.module';
import { PDF_GENERATOR_PORT } from './application/ports/pdf-generator.port';
import { ReactPdfAdapter } from './infrastructure/pdf/react-pdf.adapter';

import { MOTORCYCLE_UNIT_REPOSITORY } from './domain/repositories/motorcycle-unit.repository';
import { MotorcycleUnitPrismaRepository } from './infrastructure/persistence/prisma/repositories/motorcycle-unit.prisma-repository';
import { SALE_ORDER_REPOSITORY } from './domain/repositories/sale-order.repository';
import { SaleOrderPrismaRepository } from './infrastructure/persistence/prisma/repositories/sale-order.prisma-repository';

import {
  RegisterMotorcycleUnitUseCase,
  UpdateMotorcycleUnitUseCase,
  ChangeMotorcycleUnitStatusUseCase,
  SearchMotorcycleUnitsUseCase,
  GetMotorcycleUnitDetailUseCase,
} from './application/use-cases/sales/motorcycle-units.use-case';
import {
  CreateSaleOrderUseCase,
  ConfirmSaleOrderUseCase,
  CancelSaleOrderUseCase,
  SearchSaleOrdersUseCase,
  GetSaleOrderDetailUseCase,
  GetSaleContractUrlUseCase,
} from './application/use-cases/sales/sale-orders.use-case';

import { MotorcycleUnitsController } from './presentation/http/controllers/motorcycle-units.controller';
import { SaleOrdersController } from './presentation/http/controllers/sale-orders.controller';

@Module({
  imports: [PrismaModule, IdentityModule, CustomersModule, StorageModule],
  controllers: [MotorcycleUnitsController, SaleOrdersController],
  providers: [
    { provide: MOTORCYCLE_UNIT_REPOSITORY, useClass: MotorcycleUnitPrismaRepository },
    { provide: SALE_ORDER_REPOSITORY, useClass: SaleOrderPrismaRepository },
    { provide: PDF_GENERATOR_PORT, useClass: ReactPdfAdapter },
    RegisterMotorcycleUnitUseCase,
    UpdateMotorcycleUnitUseCase,
    ChangeMotorcycleUnitStatusUseCase,
    SearchMotorcycleUnitsUseCase,
    GetMotorcycleUnitDetailUseCase,
    CreateSaleOrderUseCase,
    ConfirmSaleOrderUseCase,
    CancelSaleOrderUseCase,
    SearchSaleOrdersUseCase,
    GetSaleOrderDetailUseCase,
    GetSaleContractUrlUseCase,
  ],
  exports: [MOTORCYCLE_UNIT_REPOSITORY, SALE_ORDER_REPOSITORY],
})
export class SalesModule {}
