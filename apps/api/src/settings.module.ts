import { Module } from '@nestjs/common';
import { IdentityModule } from './identity.module';
import { StorageModule } from './storage.module';
import { UpdateTenantLogoUseCase } from './application/use-cases/identity/update-tenant-logo.use-case';
import { SettingsController } from './presentation/http/controllers/settings.controller';

/** Tenant configuration: logo upload (other config via TenantsController). */
@Module({
  imports: [IdentityModule, StorageModule],
  controllers: [SettingsController],
  providers: [UpdateTenantLogoUseCase],
})
export class SettingsModule {}
