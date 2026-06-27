import { Module } from '@nestjs/common';
import { IdentityModule } from './identity.module';
import { MotorcycleCatalogController } from './presentation/http/controllers/motorcycle-catalog.controller';

/**
 * Read-only reference data shared across tenants (e.g. the motorcycle
 * make/model catalog). No persistence; served from in-memory curated data.
 */
@Module({
  imports: [IdentityModule],
  controllers: [MotorcycleCatalogController],
})
export class ReferenceModule {}
