import { Module } from '@nestjs/common';
import { PrismaModule } from './infrastructure/persistence/prisma/prisma.module';
import { IdentityModule } from './identity.module';

import { CUSTOMER_REPOSITORY } from './domain/repositories/customer.repository';
import { CustomerPrismaRepository } from './infrastructure/persistence/prisma/repositories/customer.prisma-repository';

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
    RegisterCustomerUseCase,
    UpdateCustomerUseCase,
    DeactivateCustomerUseCase,
    SearchCustomersUseCase,
    GetCustomerProfileUseCase,
  ],
  exports: [CUSTOMER_REPOSITORY],
})
export class CustomersModule {}
