import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ReportRepository,
  REPORT_REPOSITORY,
} from '../../../../domain/repositories/report.repository';

export interface RecordReportInput {
  tenantId: string;
  type: string;
  periodStart: Date;
  periodEnd: Date;
  pdfR2Key: string;
}

@Injectable()
export class RecordReportUseCase {
  constructor(@Inject(REPORT_REPOSITORY) private readonly reports: ReportRepository) {}

  async execute(input: RecordReportInput) {
    const id = randomUUID();
    await this.reports.create({
      id,
      tenantId: input.tenantId,
      type: input.type,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      pdfR2Key: input.pdfR2Key,
      status: 'READY',
      generatedAt: new Date(),
      createdAt: new Date(),
    });
    return { id, status: 'READY' };
  }
}
