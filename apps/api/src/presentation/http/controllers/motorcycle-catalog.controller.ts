import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import {
  MOTORCYCLE_CATALOG,
  MOTORCYCLE_BRANDS,
} from '../../../infrastructure/reference/motorcycle-catalog.data';

/**
 * Reference catalog of motorcycle makes/models (Colombia). Read-only, shared by
 * all tenants; used to autofill brand/model/year when registering a vehicle.
 */
@Controller('motorcycle-catalog')
@UseGuards(JwtAuthGuard)
export class MotorcycleCatalogController {
  @Get('brands')
  brands(): string[] {
    return MOTORCYCLE_BRANDS;
  }

  @Get()
  search(@Query('search') search?: string, @Query('limit') limit?: string) {
    const max = Math.min(limit ? parseInt(limit, 10) : 30, 100);
    const q = (search ?? '').trim().toLowerCase();
    const source = q
      ? MOTORCYCLE_CATALOG.filter(
          (e) =>
            e.brand.toLowerCase().includes(q) || `${e.brand} ${e.model}`.toLowerCase().includes(q),
        )
      : MOTORCYCLE_CATALOG;
    return source.slice(0, max);
  }
}
