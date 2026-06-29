import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ReportRepository,
  REPORT_REPOSITORY,
  ReportRecord,
} from '../../../../domain/repositories/report.repository';

export interface GenerateReportInput {
  tenantId: string;
  type: string;
  periodStart: Date;
  periodEnd: Date;
}

@Injectable()
export class GenerateReportUseCase {
  constructor(@Inject(REPORT_REPOSITORY) private readonly reports: ReportRepository) {}

  async execute(input: GenerateReportInput) {
    const id = randomUUID();
    const report: ReportRecord = {
      id,
      tenantId: input.tenantId,
      type: input.type,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      pdfR2Key: null,
      status: 'PENDING',
      generatedAt: null,
      createdAt: new Date(),
    };
    await this.reports.create(report);
    return { id, status: 'PENDING' };
  }
}
