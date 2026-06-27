import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionGuard } from '../guards/permission.guard';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { JWTPayload } from '../../../application/ports/jwt.port';
import {
  CreateSaleOrderUseCase,
  ConfirmSaleOrderUseCase,
  CancelSaleOrderUseCase,
  SearchSaleOrdersUseCase,
  GetSaleOrderDetailUseCase,
  GetSaleContractUrlUseCase,
  CreateSaleOrderInput,
} from '../../../application/use-cases/sales/sale-orders.use-case';

@Controller('sale-orders')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SaleOrdersController {
  constructor(
    private readonly createOrder: CreateSaleOrderUseCase,
    private readonly confirmOrder: ConfirmSaleOrderUseCase,
    private readonly cancelOrder: CancelSaleOrderUseCase,
    private readonly searchOrders: SearchSaleOrdersUseCase,
    private readonly getDetail: GetSaleOrderDetailUseCase,
    private readonly contractUrl: GetSaleContractUrlUseCase,
  ) {}

  @Get()
  @RequirePermission('sales:READ')
  async search(
    @CurrentUser() user: JWTPayload,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.searchOrders.execute({
      tenantId: user.tenantId,
      status,
      customerId,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
  }

  @Post()
  @RequirePermission('sales:CREATE')
  async create(
    @CurrentUser() user: JWTPayload,
    @Body()
    body: Omit<CreateSaleOrderInput, 'tenantId' | 'branchId' | 'createdBy'> & { branchId?: string },
  ) {
    return this.createOrder.execute({
      ...body,
      tenantId: user.tenantId,
      branchId: body.branchId ?? user.branchId ?? '',
      createdBy: user.sub,
    });
  }

  @Get(':id')
  @RequirePermission('sales:READ')
  async getOne(@Param('id') id: string, @CurrentUser() user: JWTPayload) {
    return this.getDetail.execute(id, user.tenantId);
  }

  @Get(':id/contract')
  @RequirePermission('sales:READ')
  async contract(@Param('id') id: string, @CurrentUser() user: JWTPayload) {
    return this.contractUrl.execute(id, user.tenantId);
  }

  @Post(':id/confirm')
  @HttpCode(200)
  @RequirePermission('sales:UPDATE')
  async confirm(@Param('id') id: string, @CurrentUser() user: JWTPayload) {
    await this.confirmOrder.execute(id, user.tenantId);
    return { success: true };
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermission('sales:UPDATE')
  async cancel(@Param('id') id: string, @CurrentUser() user: JWTPayload) {
    await this.cancelOrder.execute(id, user.tenantId);
    return { success: true };
  }
}
