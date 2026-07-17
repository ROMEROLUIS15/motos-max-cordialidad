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
import { RATE_LIMIT_PER_HOUR, RATE_LIMIT_PER_MINUTE } from './presentation/http/rate-limit.policy';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [
        // Short window: absorbs bursts. A page load fans out to several routes,
        // but each route has its own counter (see GlobalThrottlerGuard), so this
        // is 60/minute per route per caller.
        // MUST be named 'default' — route-level @Throttle({ default: {...} })
        // overrides target the throttler by name; two unnamed entries both
        // resolve to 'default' and the override becomes ambiguous.
        { name: 'default', ttl: 60_000, limit: RATE_LIMIT_PER_MINUTE },
        // Long window: a circuit breaker against sustained abuse. The ceiling is
        // derived from what the web client itself does — it polls some routes on
        // a timer — with headroom on top; see RATE_LIMIT_PER_HOUR and the test
        // that keeps both numbers in agreement.
        { name: 'hourly', ttl: 3_600_000, limit: RATE_LIMIT_PER_HOUR },
      ],
      // E2E tests run the whole suite from one IP and would trip real limits.
      // Under NODE_ENV=test throttling is skipped UNLESS the request opts in
      // with `x-e2e-throttle: on` (used by the rate-limiting tests themselves).
      // NODE_ENV=test never happens in production (Dockerfile sets production).
      skipIf: (context) => {
        if (process.env['NODE_ENV'] !== 'test') return false;
        const req = context.switchToHttp().getRequest<{ headers: Record<string, unknown> }>();
        return req.headers['x-e2e-throttle'] !== 'on';
      },
    }),
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
    // Keys by caller (user when authenticated, IP when not) + path, so each
    // route has its own counter and a shared office IP is not a shared quota.
    // Per-route @Throttle() overrides still apply on top of this.
    { provide: APP_GUARD, useClass: GlobalThrottlerGuard },
  ],
})
export class AppModule {}
