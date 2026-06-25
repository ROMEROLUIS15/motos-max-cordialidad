import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Payment } from '../../../domain/entities/payment.entity';
import { PaymentMethod, isPaymentMethod } from '../../../domain/value-objects/payment-method.vo';
import {
  PaymentRepository,
  PAYMENT_REPOSITORY,
  PaymentFilters,
} from '../../../domain/repositories/payment.repository';
import {
  WorkOrderRepository,
  WORK_ORDER_REPOSITORY,
} from '../../../domain/repositories/work-order.repository';
import { NotificationPort, NOTIFICATION_PORT } from '../../ports/notification.port';
import { Pagination, PaginatedResult } from '../../../domain/shared/pagination';

export interface RegisterPaymentInput {
  tenantId: string;
  workOrderId: string;
  amount: number;
  paymentMethod: string;
  reference?: string;
  notes?: string;
  createdBy: string;
}

@Injectable()
export class RegisterPaymentUseCase {
  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly paymentRepo: PaymentRepository,
    @Inject(NOTIFICATION_PORT) private readonly notification: NotificationPort,
  ) {}

  async execute(input: RegisterPaymentInput): Promise<Payment> {
    if (!isPaymentMethod(input.paymentMethod)) {
      throw new UnprocessableEntityException(
        `Método de pago inválido. Valores: ${Object.values(PaymentMethod).join(', ')}`,
      );
    }
    // amount <= 0 is rejected by the Payment entity invariant (422 via DomainExceptionFilter).
    const payment = new Payment(
      randomUUID(),
      input.tenantId,
      input.workOrderId,
      input.amount,
      input.paymentMethod,
      input.reference ?? null,
      input.notes ?? null,
      new Date(),
      input.createdBy,
      new Date(),
    );
    await this.paymentRepo.create(payment);

    await this.notification.notifyAdmins(input.tenantId, {
      type: 'PAYMENT_REGISTERED',
      workOrderId: input.workOrderId,
      amount: input.amount,
    });
    return payment;
  }
}

@Injectable()
export class GetPaymentSummaryUseCase {
  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly paymentRepo: PaymentRepository,
    @Inject(WORK_ORDER_REPOSITORY) private readonly workOrderRepo: WorkOrderRepository,
  ) {}

  async execute(workOrderId: string, tenantId: string) {
    const [details, payments, totalPaid] = await Promise.all([
      this.workOrderRepo.findByIdWithDetails(workOrderId, tenantId),
      this.paymentRepo.findByWorkOrder(workOrderId, tenantId),
      this.paymentRepo.sumByWorkOrder(workOrderId, tenantId),
    ]);
    if (!details) throw new NotFoundException('Orden de trabajo no encontrada');
    const orderTotal = details.total;
    return {
      orderTotal,
      totalPaid,
      balance: orderTotal - totalPaid,
      payments,
    };
  }
}

export interface SearchPaymentsInput extends PaymentFilters {
  tenantId: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class SearchPaymentsUseCase {
  constructor(@Inject(PAYMENT_REPOSITORY) private readonly paymentRepo: PaymentRepository) {}

  async execute(input: SearchPaymentsInput): Promise<PaginatedResult<Payment>> {
    const pagination: Pagination = { page: input.page ?? 1, pageSize: input.pageSize ?? 20 };
    return this.paymentRepo.search(
      { workOrderId: input.workOrderId, branchId: input.branchId, from: input.from, to: input.to },
      input.tenantId,
      pagination,
    );
  }
}
