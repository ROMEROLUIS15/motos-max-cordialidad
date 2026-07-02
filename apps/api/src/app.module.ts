import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { GlobalThrottlerGuard } from './presentation/http/guards/global-throttler.guard';
import { TraceIdInterceptor } from './presentation/http/interceptors/trace-id.interceptor';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './infrastructure/persistence/prisma/prisma.module';
import { IdentityModule } from './identity.module';
import { CustomersModule } from './customers.module';
import { VehiclesModule } from './vehicles.module';
import { WorkshopModule } from './workshop.module';
import { InventoryModule } from './inventory.module';
import { CommerceModule } from './commerce.module';
import { MessagingModule } from './messaging.module';
import { AiModule } from './ai.module';
import { NotificationsModule } from './notifications.module';
import { DashboardModule } from './dashboard.module';
import { AuditModule } from './audit.module';
import { SettingsModule } from './settings.module';
import { AgentsModule } from './agents.module';
import { HomeServicesModule } from './home-services.module';
import { SalesModule } from './sales.module';
import { ReferenceModule } from './reference.module';
import { DomainExceptionFilter } from './presentation/http/filters/domain-exception.filter';
import { SentryExceptionFilter } from './presentation/http/filters/sentry-exception.filter';
import { ThrottlerExceptionFilter } from './presentation/http/filters/throttler-exception.filter';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      // Short window: 60 requests/minute per IP (general protection)
      { ttl: 60_000, limit: 60 },
      // Circuit breaker: 100 requests/hour per IP (coordinated brute-force)
      { ttl: 3_600_000, limit: 100 },
    ]),
    PrismaModule,
    IdentityModule,
    CustomersModule,
    VehiclesModule,
    WorkshopModule,
    InventoryModule,
    CommerceModule,
    MessagingModule,
    AiModule,
    NotificationsModule,
    DashboardModule,
    AuditModule,
    SettingsModule,
    AgentsModule,
    HomeServicesModule,
    SalesModule,
    ReferenceModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Catch-all (Sentry) first, then the more specific domain filter.
    { provide: APP_FILTER, useClass: SentryExceptionFilter },
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
    { provide: APP_FILTER, useClass: ThrottlerExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TraceIdInterceptor },
    // Path-aware global guard: keys by IP+path so each route has its own counter.
    // Per-route @Throttle() overrides still apply on top of this.
    { provide: APP_GUARD, useClass: GlobalThrottlerGuard },
  ],
})
export class AppModule {}
