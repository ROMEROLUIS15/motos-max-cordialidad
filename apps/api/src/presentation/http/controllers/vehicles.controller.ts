import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
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
import { RegisterVehicleUseCase } from '../../../application/use-cases/vehicles/register-vehicle.use-case';
import { UpdateVehicleUseCase } from '../../../application/use-cases/vehicles/update-vehicle.use-case';
import { UpdateVehicleDto } from '../dtos/update-vehicle.dto';
import { RegisterVehicleDto } from '../dtos/register-vehicle.dto';
import { TransferVehicleOwnershipDto } from '../dtos/transfer-vehicle-ownership.dto';
import { DeactivateVehicleUseCase } from '../../../application/use-cases/vehicles/deactivate-vehicle.use-case';
import { TransferVehicleOwnershipUseCase } from '../../../application/use-cases/vehicles/transfer-vehicle-ownership.use-case';
import { GetVehicleHistoryUseCase } from '../../../application/use-cases/vehicles/get-vehicle-history.use-case';
import {
  VehicleRepository,
  VEHICLE_REPOSITORY,
} from '../../../domain/repositories/vehicle.repository';

@Controller('vehicles')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class VehiclesController {
  constructor(
    private readonly registerVehicle: RegisterVehicleUseCase,
    private readonly updateVehicle: UpdateVehicleUseCase,
    private readonly deactivateVehicle: DeactivateVehicleUseCase,
    private readonly transferOwnership: TransferVehicleOwnershipUseCase,
    private readonly getVehicleHistory: GetVehicleHistoryUseCase,
    @Inject(VEHICLE_REPOSITORY) private readonly vehicleRepo: VehicleRepository,
  ) {}

  @Get()
  @RequirePermission('vehicles:READ')
  async findAll(@CurrentUser() user: JWTPayload, @Query('customerId') customerId?: string) {
    if (customerId) return this.vehicleRepo.findByCustomer(customerId, user.tenantId);
    return [];
  }

  @Post()
  @RequirePermission('vehicles:CREATE')
  async create(@CurrentUser() user: JWTPayload, @Body() body: RegisterVehicleDto) {
    return this.registerVehicle.execute({ ...body, tenantId: user.tenantId });
  }

  @Get(':id')
  @RequirePermission('vehicles:READ')
  async getOne(@Param('id') id: string, @CurrentUser() user: JWTPayload) {
    return this.vehicleRepo.findById(id, user.tenantId);
  }

  @Put(':id')
  @RequirePermission('vehicles:UPDATE')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: JWTPayload,
    @Body() body: UpdateVehicleDto,
  ) {
    await this.updateVehicle.execute({ ...body, vehicleId: id, tenantId: user.tenantId });
    return { success: true };
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('vehicles:DELETE')
  async remove(@Param('id') id: string, @CurrentUser() user: JWTPayload) {
    await this.deactivateVehicle.execute(id, user.tenantId);
  }

  @Post(':id/transfer')
  @RequirePermission('vehicles:UPDATE')
  async transfer(
    @Param('id') id: string,
    @CurrentUser() user: JWTPayload,
    @Body() body: TransferVehicleOwnershipDto,
  ) {
    await this.transferOwnership.execute({
      vehicleId: id,
      tenantId: user.tenantId,
      newOwnerId: body.newOwnerId,
      transferredBy: user.sub,
    });
    return { success: true };
  }

  @Get(':id/history')
  @RequirePermission('vehicles:READ')
  async getHistory(@Param('id') id: string, @CurrentUser() user: JWTPayload) {
    return this.getVehicleHistory.execute(id, user.tenantId);
  }
}
