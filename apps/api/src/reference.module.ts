import { Module } from '@nestjs/common';
import { IdentityModule } from './identity.module';
import { PrismaModule } from './infrastructure/persistence/prisma/prisma.module';
import { CUSTOM_MOTORCYCLE_MODEL_REPOSITORY } from './domain/repositories/custom-motorcycle-model.repository';
import { CustomMotorcycleModelPrismaRepository } from './infrastructure/persistence/prisma/repositories/custom-motorcycle-model.prisma-repository';
import { MotorcycleCatalogController } from './presentation/http/controllers/motorcycle-catalog.controller';

/**
 * Reference data shared across the app: the motorcycle make/model catalog
 * (curated base dataset + per-tenant custom entries).
 */
@Module({
  imports: [IdentityModule, PrismaModule],
  controllers: [MotorcycleCatalogController],
  providers: [
    {
      provide: CUSTOM_MOTORCYCLE_MODEL_REPOSITORY,
      useClass: CustomMotorcycleModelPrismaRepository,
    },
  ],
})
export class ReferenceModule {}
