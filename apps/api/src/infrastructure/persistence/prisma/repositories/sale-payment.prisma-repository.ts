import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { SalePaymentRepository } from '../../../../domain/repositories/sale-payment.repository';
import { SalePayment, SalePaymentMethod } from '../../../../domain/entities/sale-payment.entity';

type Row = {
  id: string;
  tenantId: string;
  saleOrderId: string;
  amount: Prisma.Decimal;
  method: string;
  reference: string | null;
  notes: string | null;
  paidAt: Date;
  createdBy: string;
  createdAt: Date;
};

@Injectable()
export class SalePaymentPrismaRepository implements SalePaymentRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(r: Row): SalePayment {
    return new SalePayment(
      r.id,
      r.tenantId,
      r.saleOrderId,
      Number(r.amount),
      r.method as SalePaymentMethod,
      r.reference,
      r.notes,
      r.paidAt,
      r.createdBy,
      r.createdAt,
    );
  }

  async listBySaleOrder(saleOrderId: string, tenantId: string): Promise<SalePayment[]> {
    const rows = await this.prisma.salePayment.findMany({
      where: { saleOrderId, tenantId },
      orderBy: { paidAt: 'desc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async sumBySaleOrder(saleOrderId: string, tenantId: string): Promise<number> {
    const agg = await this.prisma.salePayment.aggregate({
      where: { saleOrderId, tenantId },
      _sum: { amount: true },
    });
    return Number(agg._sum.amount ?? 0);
  }

  async create(payment: SalePayment): Promise<void> {
    await this.prisma.salePayment.create({
      data: {
        id: payment.id,
        tenantId: payment.tenantId,
        saleOrderId: payment.saleOrderId,
        amount: payment.amount,
        method: payment.method,
        reference: payment.reference,
        notes: payment.notes,
        paidAt: payment.paidAt,
        createdBy: payment.createdBy,
        createdAt: payment.createdAt,
      },
    });
  }
}
