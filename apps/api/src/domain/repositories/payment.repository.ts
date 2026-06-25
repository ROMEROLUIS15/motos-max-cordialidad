import { Payment } from '../entities/payment.entity';
import { Pagination, PaginatedResult } from '../shared/pagination';

export interface PaymentFilters {
  workOrderId?: string;
  branchId?: string;
  from?: Date;
  to?: Date;
}

export interface IncomeTrendPoint {
  date: string;
  total: number;
}

export interface PaymentRepository {
  create(payment: Payment): Promise<void>;
  findById(id: string, tenantId: string): Promise<Payment | null>;
  findByWorkOrder(workOrderId: string, tenantId: string): Promise<Payment[]>;
  search(filters: PaymentFilters, tenantId: string, pagination: Pagination): Promise<PaginatedResult<Payment>>;
  sumByWorkOrder(workOrderId: string, tenantId: string): Promise<number>;
  sumByBranchAndPeriod(branchId: string, tenantId: string, from: Date, to: Date): Promise<number>;
  incomeTrend(branchId: string, tenantId: string, days: number): Promise<IncomeTrendPoint[]>;
}

export const PAYMENT_REPOSITORY = Symbol('PaymentRepository');
