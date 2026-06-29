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
import {
  RegisterPartUseCase,
  UpdatePartUseCase,
  DeactivatePartUseCase,
  SearchPartsUseCase,
  GetPartDetailUseCase,
  RegisterPartInput,
} from '../../../application/use-cases/inventory/parts.use-case';
import { UpdatePartDto } from '../dtos/update-part.dto';

@Controller('parts')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PartsController {
  constructor(
    private readonly registerPart: RegisterPartUseCase,
    private readonly updatePart: UpdatePartUseCase,
    private readonly deactivatePart: DeactivatePartUseCase,
    private readonly searchParts: SearchPartsUseCase,
    private readonly getPartDetail: GetPartDetailUseCase,
  ) {}

  @Get()
  @RequirePermission('inventory:READ')
  async search(
    @CurrentUser() user: JWTPayload,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('branchId') branchId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.searchParts.execute({
      tenantId: user.tenantId,
      branchId: branchId ?? user.branchId ?? '',
      query: search,
      category,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
  }

  @Post()
  @RequirePermission('inventory:CREATE')
  async create(
    @CurrentUser() user: JWTPayload,
    @Body() body: Omit<RegisterPartInput, 'tenantId' | 'branchId'> & { branchId?: string },
  ) {
    return this.registerPart.execute({
      ...body,
      tenantId: user.tenantId,
      branchId: body.branchId ?? user.branchId ?? '',
    });
  }

  @Get(':id')
  @RequirePermission('inventory:READ')
  async getOne(
    @Param('id') id: string,
    @CurrentUser() user: JWTPayload,
    @Query('branchId') branchId?: string,
  ) {
    return this.getPartDetail.execute(id, user.tenantId, branchId ?? user.branchId ?? undefined);
  }

  @Put(':id')
  @RequirePermission('inventory:UPDATE')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: JWTPayload,
    @Body() body: UpdatePartDto,
  ) {
    await this.updatePart.execute({ partId: id, tenantId: user.tenantId, ...body });
    return { success: true };
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('inventory:DELETE')
  async remove(@Param('id') id: string, @CurrentUser() user: JWTPayload) {
    await this.deactivatePart.execute(id, user.tenantId);
  }
}
