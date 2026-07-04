import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionGuard } from '../guards/permission.guard';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { JWTPayload } from '../../../application/ports/jwt.port';
import {
  PaymentRepository,
  PAYMENT_REPOSITORY,
} from '../../../domain/repositories/payment.repository';
import {
  RegisterPaymentUseCase,
  GetPaymentSummaryUseCase,
  SearchPaymentsUseCase,
} from '../../../application/use-cases/commerce/payments.use-case';
import { RegisterPaymentDto } from '../dtos/register-payment.dto';

@Controller('payments')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PaymentsController {
  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly paymentRepo: PaymentRepository,
    private readonly registerPayment: RegisterPaymentUseCase,
    private readonly getSummary: GetPaymentSummaryUseCase,
    private readonly searchPayments: SearchPaymentsUseCase,
  ) {}

  @Get()
  @RequirePermission('payments:READ')
  async list(
    @CurrentUser() user: JWTPayload,
    @Query('workOrderId') workOrderId?: string,
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.searchPayments.execute({
      tenantId: user.tenantId,
      workOrderId,
      branchId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
  }

  @Post()
  @RequirePermission('payments:CREATE')
  async create(@CurrentUser() user: JWTPayload, @Body() body: RegisterPaymentDto) {
    return this.registerPayment.execute({
      tenantId: user.tenantId,
      workOrderId: body.workOrderId,
      amount: body.amount,
      paymentMethod: body.paymentMethod,
      reference: body.reference,
      notes: body.notes,
      createdBy: user.sub,
    });
  }

  @Get('summary/:workOrderId')
  @RequirePermission('payments:READ')
  async summary(@Param('workOrderId') workOrderId: string, @CurrentUser() user: JWTPayload) {
    return this.getSummary.execute(workOrderId, user.tenantId);
  }

  @Get(':id')
  @RequirePermission('payments:READ')
  async getOne(@Param('id') id: string, @CurrentUser() user: JWTPayload) {
    return this.paymentRepo.findById(id, user.tenantId);
  }
}
