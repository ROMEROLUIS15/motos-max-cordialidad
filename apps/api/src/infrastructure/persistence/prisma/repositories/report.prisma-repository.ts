import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ReportRepository, ReportRecord } from '../../../../domain/repositories/report.repository';
import {
  Pagination,
  PaginatedResult,
  paginationToSkipTake,
} from '../../../../domain/shared/pagination';

type ReportRow = {
  id: string;
  tenantId: string;
  type: string;
  periodStart: Date;
  periodEnd: Date;
  pdfR2Key: string | null;
  status: string;
  generatedAt: Date | null;
  createdAt: Date;
};

@Injectable()
export class ReportPrismaRepository implements ReportRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(report: ReportRecord): Promise<void> {
    await this.prisma.report.create({
      data: {
        id: report.id,
        tenantId: report.tenantId,
        type: report.type,
        periodStart: report.periodStart,
        periodEnd: report.periodEnd,
        pdfR2Key: report.pdfR2Key,
        status: report.status,
        generatedAt: report.generatedAt,
        createdAt: report.createdAt,
      },
    });
  }

  async findById(id: string, tenantId: string): Promise<ReportRecord | null> {
    const r = await this.prisma.report.findFirst({ where: { id, tenantId } });
    return r ? this.toRecord(r) : null;
  }

  async listByTenant(
    tenantId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<ReportRecord>> {
    const { skip, take } = paginationToSkipTake(pagination);
    const [rows, total] = await Promise.all([
      this.prisma.report.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.report.count({ where: { tenantId } }),
    ]);
    return {
      items: rows.map((r) => this.toRecord(r)),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
    };
  }

  private toRecord(r: ReportRow): ReportRecord {
    return {
      id: r.id,
      tenantId: r.tenantId,
      type: r.type,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      pdfR2Key: r.pdfR2Key,
      status: r.status,
      generatedAt: r.generatedAt,
      createdAt: r.createdAt,
    };
  }
}
