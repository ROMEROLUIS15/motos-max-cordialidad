import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import {
  PaymentRepository,
  PaymentFilters,
  IncomeTrendPoint,
} from '../../../../domain/repositories/payment.repository';
import { Payment } from '../../../../domain/entities/payment.entity';
import { PaymentMethod } from '../../../../domain/value-objects/payment-method.vo';
import { Pagination, PaginatedResult, paginationToSkipTake } from '../../../../domain/shared/pagination';

type PaymentRow = {
  id: string;
  tenantId: string;
  workOrderId: string;
  amount: Prisma.Decimal;
  paymentMethod: string;
  reference: string | null;
  notes: string | null;
  paidAt: Date;
  createdBy: string;
  createdAt: Date;
};

@Injectable()
export class PaymentPrismaRepository implements PaymentRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(r: PaymentRow): Payment {
    return new Payment(
      r.id, r.tenantId, r.workOrderId, Number(r.amount), r.paymentMethod as PaymentMethod,
      r.reference, r.notes, r.paidAt, r.createdBy, r.createdAt,
    );
  }

  async create(payment: Payment): Promise<void> {
    await this.prisma.payment.create({
      data: {
        id: payment.id, tenantId: payment.tenantId, workOrderId: payment.workOrderId,
        amount: payment.amount, paymentMethod: payment.paymentMethod, reference: payment.reference,
        notes: payment.notes, paidAt: payment.paidAt, createdBy: payment.createdBy,
        createdAt: payment.createdAt,
      },
    });
  }

  async findById(id: string, tenantId: string): Promise<Payment | null> {
    const r = await this.prisma.payment.findFirst({ where: { id, tenantId } });
    return r ? this.toDomain(r) : null;
  }

  async findByWorkOrder(workOrderId: string, tenantId: string): Promise<Payment[]> {
    const rows = await this.prisma.payment.findMany({
      where: { workOrderId, tenantId },
      orderBy: { paidAt: 'desc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async search(
    filters: PaymentFilters,
    tenantId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<Payment>> {
    const where: Prisma.PaymentWhereInput = { tenantId };
    if (filters.workOrderId) where.workOrderId = filters.workOrderId;
    if (filters.branchId) where.workOrder = { branchId: filters.branchId };
    if (filters.from || filters.to) {
      where.paidAt = {};
      if (filters.from) (where.paidAt as Prisma.DateTimeFilter).gte = filters.from;
      if (filters.to) (where.paidAt as Prisma.DateTimeFilter).lte = filters.to;
    }
    const { skip, take } = paginationToSkipTake(pagination);
    const [rows, total] = await Promise.all([
      this.prisma.payment.findMany({ where, orderBy: { paidAt: 'desc' }, skip, take }),
      this.prisma.payment.count({ where }),
    ]);
    return {
      items: rows.map((r) => this.toDomain(r)),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
    };
  }

  async sumByWorkOrder(workOrderId: string, tenantId: string): Promise<number> {
    const res = await this.prisma.payment.aggregate({
      where: { workOrderId, tenantId },
      _sum: { amount: true },
    });
    return Number(res._sum.amount ?? 0);
  }

  async sumByBranchAndPeriod(branchId: string, tenantId: string, from: Date, to: Date): Promise<number> {
    const res = await this.prisma.payment.aggregate({
      where: { tenantId, workOrder: { branchId }, paidAt: { gte: from, lte: to } },
      _sum: { amount: true },
    });
    return Number(res._sum.amount ?? 0);
  }

  async incomeTrend(branchId: string, tenantId: string, days: number): Promise<IncomeTrendPoint[]> {
    const from = new Date();
    from.setDate(from.getDate() - days);
    const rows = await this.prisma.$queryRaw<Array<{ date: Date; total: Prisma.Decimal }>>`
      SELECT date_trunc('day', pay."paidAt") AS "date", SUM(pay."amount") AS "total"
      FROM "payments" pay
      JOIN "work_orders" wo ON wo."id" = pay."workOrderId"
      WHERE pay."tenantId" = ${tenantId}
        AND wo."branchId" = ${branchId}
        AND pay."paidAt" >= ${from}
      GROUP BY date_trunc('day', pay."paidAt")
      ORDER BY "date" ASC
    `;
    return rows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      total: Number(r.total),
    }));
  }
}
