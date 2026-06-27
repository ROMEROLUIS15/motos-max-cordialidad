import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
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
  CustomMotorcycleModelRepository,
  CUSTOM_MOTORCYCLE_MODEL_REPOSITORY,
} from '../../../domain/repositories/custom-motorcycle-model.repository';
import {
  MOTORCYCLE_CATALOG,
  MOTORCYCLE_BRANDS,
  MotorcycleCatalogEntry,
} from '../../../infrastructure/reference/motorcycle-catalog.data';

/**
 * Motorcycle make/model catalog (Colombia). Combines a curated read-only base
 * dataset with per-tenant custom entries the shop adds. Used to autofill
 * brand/model/year when registering a vehicle.
 */
@Controller('motorcycle-catalog')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class MotorcycleCatalogController {
  constructor(
    @Inject(CUSTOM_MOTORCYCLE_MODEL_REPOSITORY)
    private readonly customRepo: CustomMotorcycleModelRepository,
  ) {}

  @Get('brands')
  async brands(@CurrentUser() user: JWTPayload): Promise<string[]> {
    const custom = await this.customRepo.listByTenant(user.tenantId);
    return [...new Set([...MOTORCYCLE_BRANDS, ...custom.map((c) => c.brand)])].sort();
  }

  @Get()
  async search(
    @CurrentUser() user: JWTPayload,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ): Promise<MotorcycleCatalogEntry[]> {
    const max = Math.min(limit ? parseInt(limit, 10) : 30, 100);
    const custom = await this.customRepo.listByTenant(user.tenantId);
    const all: MotorcycleCatalogEntry[] = [
      ...custom.map((c) => ({
        brand: c.brand,
        model: c.model,
        yearFrom: c.yearFrom,
        yearTo: c.yearTo,
      })),
      ...MOTORCYCLE_CATALOG,
    ];
    const q = (search ?? '').trim().toLowerCase();
    const source = q
      ? all.filter(
          (e) =>
            e.brand.toLowerCase().includes(q) || `${e.brand} ${e.model}`.toLowerCase().includes(q),
        )
      : all;
    return source.slice(0, max);
  }

  @Get('custom')
  @RequirePermission('vehicles:READ')
  async listCustom(@CurrentUser() user: JWTPayload) {
    return this.customRepo.listByTenant(user.tenantId);
  }

  @Post('custom')
  @RequirePermission('vehicles:CREATE')
  async addCustom(
    @CurrentUser() user: JWTPayload,
    @Body() body: { brand: string; model: string; yearFrom?: number; yearTo?: number | null },
  ) {
    return this.customRepo.create({
      tenantId: user.tenantId,
      brand: body.brand.trim(),
      model: body.model.trim(),
      yearFrom: body.yearFrom ?? 1995,
      yearTo: body.yearTo ?? null,
    });
  }

  @Delete('custom/:id')
  @HttpCode(204)
  @RequirePermission('vehicles:DELETE')
  async removeCustom(@Param('id') id: string, @CurrentUser() user: JWTPayload) {
    await this.customRepo.delete(id, user.tenantId);
  }
}
