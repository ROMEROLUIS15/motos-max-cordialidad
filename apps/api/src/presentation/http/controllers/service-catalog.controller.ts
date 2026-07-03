import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionGuard } from '../guards/permission.guard';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { JWTPayload } from '../../../application/ports/jwt.port';
import {
  CreateServiceCatalogItemUseCase,
  UpdateServiceCatalogItemUseCase,
  DeactivateServiceCatalogItemUseCase,
  ListServiceCatalogItemsUseCase,
} from '../../../application/use-cases/inventory/service-catalog.use-case';
import { UpdateServiceCatalogItemDto } from '../dtos/update-service-catalog-item.dto';

@Controller('service-catalog')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ServiceCatalogController {
  constructor(
    private readonly createItem: CreateServiceCatalogItemUseCase,
    private readonly updateItem: UpdateServiceCatalogItemUseCase,
    private readonly deactivateItem: DeactivateServiceCatalogItemUseCase,
    private readonly listItems: ListServiceCatalogItemsUseCase,
  ) {}

  @Get()
  @RequirePermission('work_orders:READ')
  async list(
    @CurrentUser() user: JWTPayload,
    @Query('serviceType') serviceType?: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.listItems.execute({
      tenantId: user.tenantId,
      serviceType,
      search,
      isActive: isActive === undefined ? undefined : isActive === 'true',
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
  }

  @Post()
  @RequirePermission('inventory:CREATE')
  async create(
    @CurrentUser() user: JWTPayload,
    @Body()
    body: {
      name: string;
      description?: string;
      estimatedHours: number;
      suggestedPrice: number;
      serviceType: string;
    },
  ) {
    return this.createItem.execute({ ...body, tenantId: user.tenantId });
  }

  @Get(':id')
  @RequirePermission('work_orders:READ')
  async getOne(@Param('id') id: string, @CurrentUser() user: JWTPayload) {
    return this.listItems
      .execute({ tenantId: user.tenantId, page: 1, pageSize: 1000 })
      .then((r) => r.items.find((i) => i.id === id) ?? null);
  }

  @Put(':id')
  @RequirePermission('inventory:UPDATE')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: JWTPayload,
    @Body() body: UpdateServiceCatalogItemDto,
  ) {
    await this.updateItem.execute({ ...body, id, tenantId: user.tenantId });
    return { success: true };
  }

  @Post(':id/deactivate')
  @RequirePermission('inventory:UPDATE')
  async deactivate(@Param('id') id: string, @CurrentUser() user: JWTPayload) {
    await this.deactivateItem.execute(id, user.tenantId);
    return { success: true };
  }
}
