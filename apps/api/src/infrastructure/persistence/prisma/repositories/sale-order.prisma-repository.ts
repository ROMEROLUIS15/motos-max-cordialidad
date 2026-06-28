import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import {
  SaleOrderRepository,
  SaleOrderSearchFilters,
  SaleOrderListItem,
  SaleOrderDetailView,
  SalesSummary,
} from '../../../../domain/repositories/sale-order.repository';
import {
  SaleOrder,
  SaleOrderStatus,
  SalePaymentMethod,
} from '../../../../domain/entities/sale-order.entity';
import {
  Pagination,
  PaginatedResult,
  paginationToSkipTake,
} from '../../../../domain/shared/pagination';

type SaleOrderRow = {
  id: string;
  tenantId: string;
  branchId: string;
  customerId: string;
  motorcycleUnitId: string;
  orderNumber: string;
  salePrice: Prisma.Decimal;
  discount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  paymentMethod: string;
  downPayment: Prisma.Decimal;
  financingMonths: number | null;
  status: string;
  notes: string | null;
  contractR2Key: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class SaleOrderPrismaRepository implements SaleOrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(r: SaleOrderRow): SaleOrder {
    return new SaleOrder(
      r.id,
      r.tenantId,
      r.branchId,
      r.customerId,
      r.motorcycleUnitId,
      r.orderNumber,
      Number(r.salePrice),
      Number(r.discount),
      Number(r.totalAmount),
      r.paymentMethod as SalePaymentMethod,
      Number(r.downPayment),
      r.financingMonths,
      r.status as SaleOrderStatus,
      r.notes,
      r.contractR2Key,
      r.createdBy,
      r.createdAt,
      r.updatedAt,
    );
  }

  async findById(id: string, tenantId: string): Promise<SaleOrder | null> {
    const r = await this.prisma.saleOrder.findFirst({ where: { id, tenantId } });
    return r ? this.toDomain(r) : null;
  }

  async findDetailById(id: string, tenantId: string): Promise<SaleOrderDetailView | null> {
    const r = await this.prisma.saleOrder.findFirst({
      where: { id, tenantId },
      include: {
        customer: { select: { fullName: true } },
        motorcycleUnit: { select: { brand: true, model: true, vin: true } },
      },
    });
    if (!r) return null;
    return {
      id: r.id,
      orderNumber: r.orderNumber,
      status: r.status,
      salePrice: Number(r.salePrice),
      discount: Number(r.discount),
      totalAmount: Number(r.totalAmount),
      paymentMethod: r.paymentMethod,
      downPayment: Number(r.downPayment),
      financingMonths: r.financingMonths,
      contractR2Key: r.contractR2Key,
      notes: r.notes,
      createdAt: r.createdAt,
      customerId: r.customerId,
      customerName: r.customer.fullName,
      motorcycleUnitId: r.motorcycleUnitId,
      motorcycleLabel: `${r.motorcycleUnit.brand} ${r.motorcycleUnit.model} · ${r.motorcycleUnit.vin}`,
    };
  }

  async findActiveByUnit(motorcycleUnitId: string, tenantId: string): Promise<SaleOrder | null> {
    const r = await this.prisma.saleOrder.findFirst({
      where: { motorcycleUnitId, tenantId, status: { in: ['DRAFT', 'CONFIRMED'] } },
    });
    return r ? this.toDomain(r) : null;
  }

  async search(
    filters: SaleOrderSearchFilters,
    tenantId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<SaleOrderListItem>> {
    const where: Prisma.SaleOrderWhereInput = { tenantId };
    if (filters.status) where.status = filters.status;
    if (filters.customerId) where.customerId = filters.customerId;
    const { skip, take } = paginationToSkipTake(pagination);
    const [rows, total] = await Promise.all([
      this.prisma.saleOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          customer: { select: { fullName: true } },
          motorcycleUnit: { select: { brand: true, model: true, vin: true } },
        },
      }),
      this.prisma.saleOrder.count({ where }),
    ]);
    const items: SaleOrderListItem[] = rows.map((r) => ({
      id: r.id,
      orderNumber: r.orderNumber,
      status: r.status,
      totalAmount: Number(r.totalAmount),
      paymentMethod: r.paymentMethod,
      customerId: r.customerId,
      customerName: r.customer.fullName,
      motorcycleUnitId: r.motorcycleUnitId,
      motorcycleLabel: `${r.motorcycleUnit.brand} ${r.motorcycleUnit.model} · ${r.motorcycleUnit.vin}`,
      createdAt: r.createdAt,
    }));
    return { items, total, page: pagination.page, pageSize: pagination.pageSize };
  }

  async create(order: SaleOrder): Promise<void> {
    await this.prisma.saleOrder.create({
      data: {
        id: order.id,
        tenantId: order.tenantId,
        branchId: order.branchId,
        customerId: order.customerId,
        motorcycleUnitId: order.motorcycleUnitId,
        orderNumber: order.orderNumber,
        salePrice: order.salePrice,
        discount: order.discount,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        downPayment: order.downPayment,
        financingMonths: order.financingMonths,
        status: order.status,
        notes: order.notes,
        contractR2Key: order.contractR2Key,
        createdBy: order.createdBy,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
    });
  }

  async save(order: SaleOrder): Promise<void> {
    await this.prisma.saleOrder.update({
      where: { id: order.id },
      data: {
        salePrice: order.salePrice,
        discount: order.discount,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        downPayment: order.downPayment,
        financingMonths: order.financingMonths,
        status: order.status,
        notes: order.notes,
        contractR2Key: order.contractR2Key,
        updatedAt: order.updatedAt,
      },
    });
  }

  async generateOrderNumber(tenantId: string, year: number): Promise<string> {
    const prefix = `V-${year}-`;
    const count = await this.prisma.saleOrder.count({
      where: { tenantId, orderNumber: { startsWith: prefix } },
    });
    return `${prefix}${(count + 1).toString().padStart(6, '0')}`;
  }

  async summary(tenantId: string, from: Date, to: Date): Promise<SalesSummary> {
    const [byStatus, inventory, topBrands, monthlyTrend] = await Promise.all([
      this.prisma.saleOrder.groupBy({
        by: ['status'],
        where: { tenantId, createdAt: { gte: from, lte: to } },
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.motorcycleUnit.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<{ brand: string; units: number; revenue: number }[]>`
        SELECT mu.brand AS brand, COUNT(*)::int AS units,
               COALESCE(SUM(so."totalAmount"), 0)::float AS revenue
        FROM sale_orders so
        JOIN motorcycle_units mu ON mu.id = so."motorcycleUnitId"
        WHERE so."tenantId" = ${tenantId} AND so.status = 'CONFIRMED'
          AND so."createdAt" BETWEEN ${from} AND ${to}
        GROUP BY mu.brand ORDER BY units DESC, revenue DESC LIMIT 5`,
      this.prisma.$queryRaw<{ month: string; count: number; revenue: number }[]>`
        SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month,
               COUNT(*)::int AS count,
               COALESCE(SUM("totalAmount"), 0)::float AS revenue
        FROM sale_orders
        WHERE "tenantId" = ${tenantId} AND status = 'CONFIRMED'
          AND "createdAt" >= ${from}
        GROUP BY 1 ORDER BY 1`,
    ]);

    const stat = (s: string) => byStatus.find((r) => r.status === s);
    const confirmed = stat('CONFIRMED');
    const confirmedCount = confirmed?._count._all ?? 0;
    const confirmedRevenue = Number(confirmed?._sum.totalAmount ?? 0);
    const invStat = (s: string) => inventory.find((r) => r.status === s)?._count._all ?? 0;

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      sales: {
        confirmedCount,
        confirmedRevenue,
        draftCount: stat('DRAFT')?._count._all ?? 0,
        cancelledCount: stat('CANCELLED')?._count._all ?? 0,
        avgTicket: confirmedCount > 0 ? Math.round(confirmedRevenue / confirmedCount) : 0,
      },
      inventory: {
        available: invStat('AVAILABLE'),
        reserved: invStat('RESERVED'),
        sold: invStat('SOLD'),
      },
      topBrands: topBrands.map((b) => ({
        brand: b.brand,
        units: Number(b.units),
        revenue: Number(b.revenue),
      })),
      monthlyTrend: monthlyTrend.map((m) => ({
        month: m.month,
        count: Number(m.count),
        revenue: Number(m.revenue),
      })),
    };
  }
}
