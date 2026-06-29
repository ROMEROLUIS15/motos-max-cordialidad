import { Inject, Injectable } from '@nestjs/common';
import {
  ReportRepository,
  REPORT_REPOSITORY,
} from '../../../../domain/repositories/report.repository';
import { Pagination } from '../../../../domain/shared/pagination';

@Injectable()
export class ListReportsUseCase {
  constructor(@Inject(REPORT_REPOSITORY) private readonly reports: ReportRepository) {}

  async execute(tenantId: string, pagination: Pagination) {
    return this.reports.listByTenant(tenantId, pagination);
  }
}
