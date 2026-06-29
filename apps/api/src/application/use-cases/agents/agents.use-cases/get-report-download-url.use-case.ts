import { Inject, Injectable } from '@nestjs/common';
import {
  ReportRepository,
  REPORT_REPOSITORY,
} from '../../../../domain/repositories/report.repository';
import { StoragePort, STORAGE_PORT } from '../../../../application/ports/storage.port';

const REPORT_URL_TTL_SECONDS = 7 * 24 * 60 * 60;

@Injectable()
export class GetReportDownloadUrlUseCase {
  constructor(
    @Inject(REPORT_REPOSITORY) private readonly reports: ReportRepository,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  async execute(reportId: string, tenantId: string) {
    const report = await this.reports.findById(reportId, tenantId);
    if (!report) return { status: 'NOT_FOUND' as const };
    if (report.status !== 'READY' || !report.pdfR2Key) {
      return { status: 'NOT_READY' as const, reportStatus: report.status };
    }
    const url = await this.storage.getSignedUrl(report.pdfR2Key, REPORT_URL_TTL_SECONDS);
    return { status: 'OK' as const, url, expiresInSeconds: REPORT_URL_TTL_SECONDS };
  }
}
