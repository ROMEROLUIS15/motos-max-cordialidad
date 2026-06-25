import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './infrastructure/persistence/prisma/prisma.module';
import { IdentityModule } from './identity.module';

import { AUDIT_LOG_REPOSITORY } from './domain/repositories/audit-log.repository';
import { AuditLogPrismaRepository } from './infrastructure/persistence/prisma/repositories/audit-log.prisma-repository';
import { QueryAuditLogUseCase } from './application/use-cases/audit/query-audit-log.use-case';
import { AuditLogInterceptor } from './presentation/http/interceptors/audit-log.interceptor';
import { AuditController } from './presentation/http/controllers/audit.controller';

@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [AuditController],
  providers: [
    { provide: AUDIT_LOG_REPOSITORY, useClass: AuditLogPrismaRepository },
    QueryAuditLogUseCase,
    // Global interceptor: audits all mutating requests.
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
  ],
})
export class AuditModule {}
