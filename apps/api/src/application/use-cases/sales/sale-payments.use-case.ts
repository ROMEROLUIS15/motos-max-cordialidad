import {
  Inject,
  Injectable,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SalePayment, SalePaymentMethod } from '../../../domain/entities/sale-payment.entity';
import {
  SalePaymentRepository,
  SALE_PAYMENT_REPOSITORY,
} from '../../../domain/repositories/sale-payment.repository';
import {
  SaleOrderRepository,
  SALE_ORDER_REPOSITORY,
} from '../../../domain/repositories/sale-order.repository';

export interface RecordSalePaymentInput {
  tenantId: string;
  saleOrderId: string;
  createdBy: string;
  amount: number;
  method: SalePaymentMethod;
  reference?: string | null;
  notes?: string | null;
  paidAt?: Date;
}

@Injectable()
export class RecordSalePaymentUseCase {
  constructor(
    @Inject(SALE_PAYMENT_REPOSITORY) private readonly paymentRepo: SalePaymentRepository,
    @Inject(SALE_ORDER_REPOSITORY) private readonly orderRepo: SaleOrderRepository,
  ) {}

  async execute(input: RecordSalePaymentInput): Promise<SalePayment> {
    const order = await this.orderRepo.findById(input.saleOrderId, input.tenantId);
    if (!order) throw new NotFoundException('Orden de venta no encontrada');
    if (order.status === 'CANCELLED') {
      throw new ConflictException('No se pueden registrar pagos en una venta cancelada');
    }
    if (input.amount <= 0) {
      throw new UnprocessableEntityException('El monto del pago debe ser mayor a cero');
    }

    const paid = await this.paymentRepo.sumBySaleOrder(input.saleOrderId, input.tenantId);
    const balance = Math.round((order.totalAmount - paid) * 100) / 100;
    if (input.amount > balance) {
      throw new UnprocessableEntityException(
        `El pago (${input.amount}) excede el saldo pendiente (${balance})`,
      );
    }

    const payment = new SalePayment(
      randomUUID(),
      input.tenantId,
      input.saleOrderId,
      input.amount,
      input.method,
      input.reference ?? null,
      input.notes ?? null,
      input.paidAt ?? new Date(),
      input.createdBy,
      new Date(),
    );
    await this.paymentRepo.create(payment);
    return payment;
  }
}

@Injectable()
export class ListSalePaymentsUseCase {
  constructor(
    @Inject(SALE_PAYMENT_REPOSITORY) private readonly paymentRepo: SalePaymentRepository,
    @Inject(SALE_ORDER_REPOSITORY) private readonly orderRepo: SaleOrderRepository,
  ) {}

  async execute(saleOrderId: string, tenantId: string) {
    const order = await this.orderRepo.findById(saleOrderId, tenantId);
    if (!order) throw new NotFoundException('Orden de venta no encontrada');
    const payments = await this.paymentRepo.listBySaleOrder(saleOrderId, tenantId);
    const paid = payments.reduce((sum, p) => sum + p.amount, 0);
    const balance = Math.round((order.totalAmount - paid) * 100) / 100;
    return { payments, total: order.totalAmount, paid, balance };
  }
}
