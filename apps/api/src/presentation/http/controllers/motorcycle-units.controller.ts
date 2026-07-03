import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionGuard } from '../guards/permission.guard';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { JWTPayload } from '../../../application/ports/jwt.port';
import {
  RegisterMotorcycleUnitUseCase,
  UpdateMotorcycleUnitUseCase,
  ChangeMotorcycleUnitStatusUseCase,
  SearchMotorcycleUnitsUseCase,
  GetMotorcycleUnitDetailUseCase,
  RegisterMotorcycleUnitInput,
} from '../../../application/use-cases/sales/motorcycle-units.use-case';
import { UpdateMotorcycleUnitDto } from '../dtos/update-motorcycle-unit.dto';
import { MotorcycleStatus } from '../../../domain/entities/motorcycle-unit.entity';

@Controller('motorcycle-units')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class MotorcycleUnitsController {
  constructor(
    private readonly registerUnit: RegisterMotorcycleUnitUseCase,
    private readonly updateUnit: UpdateMotorcycleUnitUseCase,
    private readonly changeStatus: ChangeMotorcycleUnitStatusUseCase,
    private readonly searchUnits: SearchMotorcycleUnitsUseCase,
    private readonly getDetail: GetMotorcycleUnitDetailUseCase,
  ) {}

  @Get()
  @RequirePermission('sales:READ')
  async search(
    @CurrentUser() user: JWTPayload,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('condition') condition?: string,
    @Query('branchId') branchId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.searchUnits.execute({
      tenantId: user.tenantId,
      query: search,
      status,
      condition,
      branchId,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
  }

  @Post()
  @RequirePermission('sales:CREATE')
  async create(
    @CurrentUser() user: JWTPayload,
    @Body()
    body: Omit<RegisterMotorcycleUnitInput, 'tenantId' | 'branchId'> & { branchId?: string },
  ) {
    return this.registerUnit.execute({
      ...body,
      tenantId: user.tenantId,
      branchId: body.branchId ?? user.branchId ?? '',
    });
  }

  @Get(':id')
  @RequirePermission('sales:READ')
  async getOne(@Param('id') id: string, @CurrentUser() user: JWTPayload) {
    return this.getDetail.execute(id, user.tenantId);
  }

  @Put(':id')
  @RequirePermission('sales:UPDATE')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: JWTPayload,
    @Body() body: UpdateMotorcycleUnitDto,
  ) {
    await this.updateUnit.execute({ ...body, unitId: id, tenantId: user.tenantId });
    return { success: true };
  }

  @Patch(':id/status')
  @RequirePermission('sales:UPDATE')
  async setStatus(
    @Param('id') id: string,
    @CurrentUser() user: JWTPayload,
    @Body() body: { status: MotorcycleStatus },
  ) {
    await this.changeStatus.execute(id, user.tenantId, body.status);
    return { success: true };
  }
}
