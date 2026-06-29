import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
import { MailModule } from './infrastructure/mail/mail.module';
import { SalesModule } from './sales.module';
import { ReferenceModule } from './reference.module';
import { DomainExceptionFilter } from './presentation/http/filters/domain-exception.filter';
import { SentryExceptionFilter } from './presentation/http/filters/sentry-exception.filter';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
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
    MailModule,
    SalesModule,
    ReferenceModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Catch-all (Sentry) first, then the more specific domain filter.
    { provide: APP_FILTER, useClass: SentryExceptionFilter },
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TraceIdInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
