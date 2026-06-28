import { SaleOrder } from '../entities/sale-order.entity';
import { Pagination, PaginatedResult } from '../shared/pagination';

export interface SaleOrderSearchFilters {
  status?: string;
  customerId?: string;
}

export interface SaleOrderListItem {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  paymentMethod: string;
  customerId: string;
  customerName: string;
  motorcycleUnitId: string;
  motorcycleLabel: string;
  createdAt: Date;
}

export interface SalesSummary {
  period: { from: string; to: string };
  sales: {
    confirmedCount: number;
    confirmedRevenue: number;
    draftCount: number;
    cancelledCount: number;
    avgTicket: number;
  };
  inventory: { available: number; reserved: number; sold: number };
  topBrands: { brand: string; units: number; revenue: number }[];
  monthlyTrend: { month: string; count: number; revenue: number }[];
}

export interface SaleOrderDetailView {
  id: string;
  orderNumber: string;
  status: string;
  salePrice: number;
  discount: number;
  totalAmount: number;
  paymentMethod: string;
  downPayment: number;
  financingMonths: number | null;
  contractR2Key: string | null;
  notes: string | null;
  createdAt: Date;
  customerId: string;
  customerName: string;
  motorcycleUnitId: string;
  motorcycleLabel: string;
}

export interface SaleOrderRepository {
  findById(id: string, tenantId: string): Promise<SaleOrder | null>;
  findDetailById(id: string, tenantId: string): Promise<SaleOrderDetailView | null>;
  findActiveByUnit(motorcycleUnitId: string, tenantId: string): Promise<SaleOrder | null>;
  search(
    filters: SaleOrderSearchFilters,
    tenantId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<SaleOrderListItem>>;
  create(order: SaleOrder): Promise<void>;
  save(order: SaleOrder): Promise<void>;
  generateOrderNumber(tenantId: string, year: number): Promise<string>;
  summary(tenantId: string, from: Date, to: Date): Promise<SalesSummary>;
}

export const SALE_ORDER_REPOSITORY = Symbol('SaleOrderRepository');
