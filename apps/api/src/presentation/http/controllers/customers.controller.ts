import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionGuard } from '../guards/permission.guard';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { JWTPayload } from '../../../application/ports/jwt.port';
import { RegisterCustomerUseCase } from '../../../application/use-cases/customers/register-customer.use-case';
import { UpdateCustomerUseCase } from '../../../application/use-cases/customers/update-customer.use-case';
import { UpdateCustomerDto } from '../dtos/update-customer.dto';
import { RegisterCustomerDto } from '../dtos/register-customer.dto';
import { DeactivateCustomerUseCase } from '../../../application/use-cases/customers/deactivate-customer.use-case';
import { SearchCustomersUseCase } from '../../../application/use-cases/customers/search-customers.use-case';
import { GetCustomerProfileUseCase } from '../../../application/use-cases/customers/get-customer-profile.use-case';

@Controller('customers')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CustomersController {
  constructor(
    private readonly registerCustomer: RegisterCustomerUseCase,
    private readonly updateCustomer: UpdateCustomerUseCase,
    private readonly deactivateCustomer: DeactivateCustomerUseCase,
    private readonly searchCustomers: SearchCustomersUseCase,
    private readonly getCustomerProfile: GetCustomerProfileUseCase,
  ) {}

  @Get()
  @RequirePermission('customers:READ')
  async search(
    @CurrentUser() user: JWTPayload,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.searchCustomers.execute({
      tenantId: user.tenantId,
      query: search,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
  }

  @Post()
  @RequirePermission('customers:CREATE')
  async create(@CurrentUser() user: JWTPayload, @Body() body: RegisterCustomerDto) {
    return this.registerCustomer.execute({ ...body, tenantId: user.tenantId });
  }

  @Get(':id')
  @RequirePermission('customers:READ')
  async getOne(@Param('id') id: string, @CurrentUser() user: JWTPayload) {
    return this.getCustomerProfile.execute(id, user.tenantId);
  }

  @Put(':id')
  @RequirePermission('customers:UPDATE')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: JWTPayload,
    @Body() body: UpdateCustomerDto,
  ) {
    await this.updateCustomer.execute({ ...body, customerId: id, tenantId: user.tenantId });
    return { success: true };
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('customers:DELETE')
  async remove(@Param('id') id: string, @CurrentUser() user: JWTPayload) {
    await this.deactivateCustomer.execute(id, user.tenantId);
  }

  @Get(':id/vehicles')
  @RequirePermission('customers:READ')
  async getVehicles(@Param('id') id: string, @CurrentUser() user: JWTPayload) {
    const profile = await this.getCustomerProfile.execute(id, user.tenantId);
    return profile.vehicles;
  }

  @Get(':id/work-orders')
  @RequirePermission('customers:READ')
  async getWorkOrders(@Param('id') id: string, @CurrentUser() user: JWTPayload) {
    const profile = await this.getCustomerProfile.execute(id, user.tenantId);
    return profile.recentWorkOrders;
  }
}
