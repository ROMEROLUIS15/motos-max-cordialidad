import { Module } from '@nestjs/common';
import { PrismaModule } from './infrastructure/persistence/prisma/prisma.module';
import { IdentityModule } from './identity.module';

// Repository tokens + implementations
import { PART_REPOSITORY } from './domain/repositories/part.repository';
import { PART_STOCK_REPOSITORY } from './domain/repositories/part-stock.repository';
import { STOCK_ENTRY_REPOSITORY } from './domain/repositories/stock-entry.repository';
import { SERVICE_CATALOG_REPOSITORY } from './domain/repositories/service-catalog.repository';
import { PartPrismaRepository } from './infrastructure/persistence/prisma/repositories/part.prisma-repository';
import { PartStockPrismaRepository } from './infrastructure/persistence/prisma/repositories/part-stock.prisma-repository';
import { StockEntryPrismaRepository } from './infrastructure/persistence/prisma/repositories/stock-entry.prisma-repository';
import { ServiceCatalogPrismaRepository } from './infrastructure/persistence/prisma/repositories/service-catalog.prisma-repository';

// Inventory port (real adapter)
import { INVENTORY_PORT } from './application/ports/inventory.port';
import { InventoryAdapter } from './infrastructure/inventory/inventory.adapter';

// Use cases
import {
  RegisterPartUseCase,
  UpdatePartUseCase,
  DeactivatePartUseCase,
  SearchPartsUseCase,
  GetPartDetailUseCase,
} from './application/use-cases/inventory/parts.use-case';
import {
  RegisterStockEntryUseCase,
  RegisterStockExitUseCase,
  AdjustInventoryUseCase,
  TransferStockBetweenBranchesUseCase,
  GetStockHistoryUseCase,
  GetLowStockUseCase,
  GetStockValuationUseCase,
} from './application/use-cases/inventory/stock-movements.use-case';
import {
  CreateServiceCatalogItemUseCase,
  UpdateServiceCatalogItemUseCase,
  DeactivateServiceCatalogItemUseCase,
  ListServiceCatalogItemsUseCase,
} from './application/use-cases/inventory/service-catalog.use-case';

// Controllers
import { PartsController } from './presentation/http/controllers/parts.controller';
import { StockController } from './presentation/http/controllers/stock.controller';
import { ServiceCatalogController } from './presentation/http/controllers/service-catalog.controller';

@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [PartsController, StockController, ServiceCatalogController],
  providers: [
    { provide: PART_REPOSITORY, useClass: PartPrismaRepository },
    { provide: PART_STOCK_REPOSITORY, useClass: PartStockPrismaRepository },
    { provide: STOCK_ENTRY_REPOSITORY, useClass: StockEntryPrismaRepository },
    { provide: SERVICE_CATALOG_REPOSITORY, useClass: ServiceCatalogPrismaRepository },
    { provide: INVENTORY_PORT, useClass: InventoryAdapter },
    RegisterPartUseCase,
    UpdatePartUseCase,
    DeactivatePartUseCase,
    SearchPartsUseCase,
    GetPartDetailUseCase,
    RegisterStockEntryUseCase,
    RegisterStockExitUseCase,
    AdjustInventoryUseCase,
    TransferStockBetweenBranchesUseCase,
    GetStockHistoryUseCase,
    GetLowStockUseCase,
    GetStockValuationUseCase,
    CreateServiceCatalogItemUseCase,
    UpdateServiceCatalogItemUseCase,
    DeactivateServiceCatalogItemUseCase,
    ListServiceCatalogItemsUseCase,
  ],
  exports: [INVENTORY_PORT, PART_STOCK_REPOSITORY, PART_REPOSITORY, STOCK_ENTRY_REPOSITORY],
})
export class InventoryModule {}
