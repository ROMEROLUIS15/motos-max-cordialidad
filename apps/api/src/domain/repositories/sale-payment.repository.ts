import { SalePayment } from '../entities/sale-payment.entity';

export interface SalePaymentRepository {
  listBySaleOrder(saleOrderId: string, tenantId: string): Promise<SalePayment[]>;
  sumBySaleOrder(saleOrderId: string, tenantId: string): Promise<number>;
  create(payment: SalePayment): Promise<void>;
}

export const SALE_PAYMENT_REPOSITORY = Symbol('SalePaymentRepository');
