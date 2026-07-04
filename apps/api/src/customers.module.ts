import { Module } from '@nestjs/common';
import { PrismaModule } from './infrastructure/persistence/prisma/prisma.module';
import { IdentityModule } from './identity.module';

import { CUSTOMER_REPOSITORY } from './domain/repositories/customer.repository';
import { WORK_ORDER_REPOSITORY } from './domain/repositories/work-order.repository';
import { VEHICLE_REPOSITORY } from './domain/repositories/vehicle.repository';
import { CustomerPrismaRepository } from './infrastructure/persistence/prisma/repositories/customer.prisma-repository';
import { WorkOrderPrismaRepository } from './infrastructure/persistence/prisma/repositories/work-order.prisma-repository';
import { VehiclePrismaRepository } from './infrastructure/persistence/prisma/repositories/vehicle.prisma-repository';

import { RegisterCustomerUseCase } from './application/use-cases/customers/register-customer.use-case';
import { UpdateCustomerUseCase } from './application/use-cases/customers/update-customer.use-case';
import { DeactivateCustomerUseCase } from './application/use-cases/customers/deactivate-customer.use-case';
import { SearchCustomersUseCase } from './application/use-cases/customers/search-customers.use-case';
import { GetCustomerProfileUseCase } from './application/use-cases/customers/get-customer-profile.use-case';

import { CustomersController } from './presentation/http/controllers/customers.controller';

@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [CustomersController],
  providers: [
    { provide: CUSTOMER_REPOSITORY, useClass: CustomerPrismaRepository },
    // Not exported to this module's import chain (would be circular with
    // WorkshopModule → VehiclesModule → CustomersModule) — bind locally.
    { provide: WORK_ORDER_REPOSITORY, useClass: WorkOrderPrismaRepository },
    { provide: VEHICLE_REPOSITORY, useClass: VehiclePrismaRepository },
    RegisterCustomerUseCase,
    UpdateCustomerUseCase,
    DeactivateCustomerUseCase,
    SearchCustomersUseCase,
    GetCustomerProfileUseCase,
  ],
  exports: [CUSTOMER_REPOSITORY],
})
export class CustomersModule {}
