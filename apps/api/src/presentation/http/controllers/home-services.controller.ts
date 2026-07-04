import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionGuard } from '../guards/permission.guard';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { JWTPayload } from '../../../application/ports/jwt.port';
import {
  CreateHomeServiceRequestUseCase,
  ListHomeServiceRequestsUseCase,
  AssignHomeServiceRequestUseCase,
  UpdateHomeServiceStatusUseCase,
} from '../../../application/use-cases/home-services/home-services.use-cases';
import { CreateHomeServiceRequestDto } from '../dtos/create-home-service-request.dto';
import { AssignHomeServiceDto } from '../dtos/assign-home-service.dto';
import { UpdateHomeServiceStatusDto } from '../dtos/update-home-service-status.dto';

/**
 * Home-service requests management (web). Reuses work_orders permissions since
 * a home service is a workshop job. Creation is also driven by the AI tool
 * (createHomeServiceRequest) via the use case directly.
 */
@Controller('home-services')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class HomeServicesController {
  constructor(
    private readonly create: CreateHomeServiceRequestUseCase,
    private readonly listRequests: ListHomeServiceRequestsUseCase,
    private readonly assign: AssignHomeServiceRequestUseCase,
    private readonly updateStatus: UpdateHomeServiceStatusUseCase,
  ) {}

  @Get()
  @RequirePermission('work_orders:READ')
  async list(
    @CurrentUser() user: JWTPayload,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.listRequests.execute(user.tenantId, status || undefined, {
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  @Post()
  @RequirePermission('work_orders:CREATE')
  async createRequest(@CurrentUser() user: JWTPayload, @Body() body: CreateHomeServiceRequestDto) {
    return this.create.execute({
      tenantId: user.tenantId,
      branchId: body.branchId ?? user.branchId ?? null,
      customerId: body.customerId ?? null,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      address: body.address,
      problemDesc: body.problemDesc,
      serviceType: body.serviceType,
    });
  }

  @Patch(':id/assign')
  @RequirePermission('work_orders:UPDATE')
  async assignTechnician(
    @CurrentUser() user: JWTPayload,
    @Param('id') id: string,
    @Body() body: AssignHomeServiceDto,
  ) {
    const updated = await this.assign.execute(id, user.tenantId, body.assignedTo);
    if (!updated) throw new NotFoundException('Home-service request not found');
    return updated;
  }

  @Patch(':id/status')
  @RequirePermission('work_orders:UPDATE')
  async changeStatus(
    @CurrentUser() user: JWTPayload,
    @Param('id') id: string,
    @Body() body: UpdateHomeServiceStatusDto,
  ) {
    const updated = await this.updateStatus.execute(id, user.tenantId, body.status);
    if (!updated) throw new NotFoundException('Home-service request not found');
    return updated;
  }
}
