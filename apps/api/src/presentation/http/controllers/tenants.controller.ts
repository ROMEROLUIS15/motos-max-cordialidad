import { Body, Controller, Get, Inject, Post, Put, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { JWTPayload } from '../../../application/ports/jwt.port';
import { CreateTenantUseCase } from '../../../application/use-cases/identity/create-tenant.use-case';
import { UpdateTenantConfigUseCase } from '../../../application/use-cases/identity/update-tenant-config.use-case';
import {
  TenantRepository,
  TENANT_REPOSITORY,
} from '../../../domain/repositories/tenant.repository';
import { UpdateTenantConfigDto } from '../dtos/update-tenant-config.dto';
import { CreateTenantDto } from '../dtos/create-tenant.dto';

@Controller('tenants')
export class TenantsController {
  constructor(
    private readonly createTenantUseCase: CreateTenantUseCase,
    private readonly updateTenantConfigUseCase: UpdateTenantConfigUseCase,
    @Inject(TENANT_REPOSITORY) private readonly tenantRepo: TenantRepository,
  ) {}

  @Post()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 300000 } })
  async create(@Body() body: CreateTenantDto) {
    return this.createTenantUseCase.execute(body);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: JWTPayload) {
    const tenant = await this.tenantRepo.findById(user.tenantId);
    if (!tenant) return null;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { whatsappToken: _token, ...safeConfig } = tenant;
    return safeConfig;
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(@CurrentUser() user: JWTPayload, @Body() body: UpdateTenantConfigDto) {
    await this.updateTenantConfigUseCase.execute({ ...body, tenantId: user.tenantId } as Parameters<
      UpdateTenantConfigUseCase['execute']
    >[0]);
    return { success: true };
  }
}
