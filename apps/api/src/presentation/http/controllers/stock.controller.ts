import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionGuard } from '../guards/permission.guard';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { JWTPayload } from '../../../application/ports/jwt.port';
import {
  RegisterStockEntryUseCase,
  RegisterStockExitUseCase,
  AdjustInventoryUseCase,
  TransferStockBetweenBranchesUseCase,
  GetStockHistoryUseCase,
  GetLowStockUseCase,
  GetStockValuationUseCase,
} from '../../../application/use-cases/inventory/stock-movements.use-case';
import { StockMovementDto } from '../dtos/stock-movement.dto';
import { AdjustStockDto } from '../dtos/adjust-stock.dto';
import { TransferStockDto } from '../dtos/transfer-stock.dto';

@Controller('stock')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class StockController {
  constructor(
    private readonly stockEntry: RegisterStockEntryUseCase,
    private readonly stockExit: RegisterStockExitUseCase,
    private readonly adjust: AdjustInventoryUseCase,
    private readonly transfer: TransferStockBetweenBranchesUseCase,
    private readonly history: GetStockHistoryUseCase,
    private readonly lowStock: GetLowStockUseCase,
    private readonly valuation: GetStockValuationUseCase,
  ) {}

  @Post('entry')
  @RequirePermission('inventory:UPDATE')
  async entry(@CurrentUser() user: JWTPayload, @Body() body: StockMovementDto) {
    await this.stockEntry.execute({
      tenantId: user.tenantId,
      partId: body.partId,
      branchId: body.branchId ?? user.branchId ?? '',
      quantity: body.quantity,
      userId: user.sub,
      notes: body.notes,
    });
    return { success: true };
  }

  @Post('exit')
  @RequirePermission('inventory:UPDATE')
  async exit(@CurrentUser() user: JWTPayload, @Body() body: StockMovementDto) {
    await this.stockExit.execute({
      tenantId: user.tenantId,
      partId: body.partId,
      branchId: body.branchId ?? user.branchId ?? '',
      quantity: body.quantity,
      userId: user.sub,
      notes: body.notes,
    });
    return { success: true };
  }

  @Post('adjust')
  @RequirePermission('inventory:UPDATE')
  async adjustStock(@CurrentUser() user: JWTPayload, @Body() body: AdjustStockDto) {
    return this.adjust.execute({
      tenantId: user.tenantId,
      partId: body.partId,
      branchId: body.branchId ?? user.branchId ?? '',
      newPhysicalCount: body.newPhysicalCount,
      userId: user.sub,
      notes: body.notes,
    });
  }

  @Post('transfer')
  @RequirePermission('inventory:UPDATE')
  async transferStock(@CurrentUser() user: JWTPayload, @Body() body: TransferStockDto) {
    await this.transfer.execute({
      tenantId: user.tenantId,
      partId: body.partId,
      fromBranchId: body.fromBranchId,
      toBranchId: body.toBranchId,
      quantity: body.quantity,
      userId: user.sub,
      notes: body.notes,
    });
    return { success: true };
  }

  @Get('history')
  @RequirePermission('inventory:READ')
  async getHistory(
    @CurrentUser() user: JWTPayload,
    @Query('partId') partId?: string,
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.history.execute({
      tenantId: user.tenantId,
      partId,
      branchId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
  }

  @Get('valuation')
  @RequirePermission('inventory:READ')
  async getValuation(@CurrentUser() user: JWTPayload, @Query('branchId') branchId?: string) {
    return this.valuation.execute(branchId ?? user.branchId ?? '', user.tenantId);
  }

  @Get('low-stock')
  @RequirePermission('inventory:READ')
  async getLowStock(@CurrentUser() user: JWTPayload, @Query('branchId') branchId?: string) {
    return this.lowStock.execute(branchId ?? user.branchId ?? '', user.tenantId);
  }
}
