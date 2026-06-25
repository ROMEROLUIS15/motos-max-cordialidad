import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import {
  QuoteRepository,
  QuoteVersionSnapshot,
} from '../../../../domain/repositories/quote.repository';
import { Quote } from '../../../../domain/entities/quote.entity';
import { QuoteStatus } from '../../../../domain/value-objects/quote-status.vo';

type QuoteRow = {
  id: string;
  tenantId: string;
  workOrderId: string;
  quoteNumber: string;
  status: string;
  subtotal: Prisma.Decimal;
  vatPercentage: Prisma.Decimal;
  vatAmount: Prisma.Decimal;
  total: Prisma.Decimal;
  validUntil: Date;
  pdfR2Key: string | null;
  termsConditions: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class QuotePrismaRepository implements QuoteRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(r: QuoteRow): Quote {
    return new Quote(
      r.id, r.tenantId, r.workOrderId, r.quoteNumber, r.status as QuoteStatus,
      Number(r.subtotal), Number(r.vatPercentage), Number(r.vatAmount), Number(r.total),
      r.validUntil, r.pdfR2Key, r.termsConditions, r.version, r.createdAt, r.updatedAt,
    );
  }

  async findById(id: string, tenantId: string): Promise<Quote | null> {
    const r = await this.prisma.quote.findFirst({ where: { id, tenantId } });
    return r ? this.toDomain(r) : null;
  }

  async findByWorkOrder(workOrderId: string, tenantId: string): Promise<Quote[]> {
    const rows = await this.prisma.quote.findMany({
      where: { workOrderId, tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findExpired(now: Date): Promise<Quote[]> {
    const rows = await this.prisma.quote.findMany({
      where: { status: QuoteStatus.SENT, validUntil: { lt: now } },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async create(quote: Quote): Promise<void> {
    await this.prisma.quote.create({
      data: {
        id: quote.id, tenantId: quote.tenantId, workOrderId: quote.workOrderId,
        quoteNumber: quote.quoteNumber, status: quote.status, subtotal: quote.subtotal,
        vatPercentage: quote.vatPercentage, vatAmount: quote.vatAmount, total: quote.total,
        validUntil: quote.validUntil, pdfR2Key: quote.pdfR2Key, termsConditions: quote.termsConditions,
        version: quote.version, createdAt: quote.createdAt, updatedAt: quote.updatedAt,
      },
    });
  }

  async save(quote: Quote): Promise<void> {
    await this.prisma.quote.update({
      where: { id: quote.id },
      data: {
        status: quote.status, subtotal: quote.subtotal, vatPercentage: quote.vatPercentage,
        vatAmount: quote.vatAmount, total: quote.total, validUntil: quote.validUntil,
        pdfR2Key: quote.pdfR2Key, termsConditions: quote.termsConditions,
        version: quote.version, updatedAt: quote.updatedAt,
      },
    });
  }

  async saveVersion(version: QuoteVersionSnapshot): Promise<void> {
    await this.prisma.quoteVersion.create({
      data: {
        quoteId: version.quoteId,
        version: version.version,
        pdfR2Key: version.pdfR2Key,
        snapshot: version.snapshot as Prisma.InputJsonValue,
      },
    });
  }

  async findVersions(
    quoteId: string,
  ): Promise<Array<{ version: number; pdfR2Key: string; createdAt: Date }>> {
    const rows = await this.prisma.quoteVersion.findMany({
      where: { quoteId },
      orderBy: { version: 'desc' },
      select: { version: true, pdfR2Key: true, createdAt: true },
    });
    return rows;
  }

  async generateQuoteNumber(tenantId: string, year: number): Promise<string> {
    const prefix = `Q-${year}-`;
    const count = await this.prisma.quote.count({
      where: { tenantId, quoteNumber: { startsWith: prefix } },
    });
    return `${prefix}${(count + 1).toString().padStart(6, '0')}`;
  }
}
