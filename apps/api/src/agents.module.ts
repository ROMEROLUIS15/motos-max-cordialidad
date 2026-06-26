import { Module } from '@nestjs/common';
import { IdentityModule } from './identity.module';
import { TokenFactoryService } from './application/services/token-factory.service';
import { ServiceAuthGuard } from './presentation/http/guards/service-auth.guard';

/**
 * Fase 2A — service-to-service surface consumed by the Python agents
 * microservice. Epic 2A-1 wires the auth primitives (service token factory +
 * guard); later epics add the AgentsController and home-services endpoints.
 * Imports IdentityModule for the shared JwtService.
 */
@Module({
  imports: [IdentityModule],
  providers: [TokenFactoryService, ServiceAuthGuard],
  exports: [TokenFactoryService, ServiceAuthGuard],
})
export class AgentsModule {}
