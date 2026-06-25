import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionGuard } from '../guards/permission.guard';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { JWTPayload } from '../../../application/ports/jwt.port';
import { GetDashboardSummaryUseCase } from '../../../application/use-cases/dashboard/get-dashboard-summary.use-case';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DashboardController {
  constructor(private readonly getSummary: GetDashboardSummaryUseCase) {}

  @Get('summary')
  @RequirePermission('reports:READ')
  async summary(
    @CurrentUser() user: JWTPayload,
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.getSummary.execute({
      tenantId: user.tenantId,
      branchId: branchId ?? user.branchId ?? '',
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }
}
