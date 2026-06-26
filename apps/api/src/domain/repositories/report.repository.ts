import { Pagination, PaginatedResult } from '../shared/pagination';

export interface ReportRecord {
  id: string;
  tenantId: string;
  type: string; // WEEKLY | MONTHLY
  periodStart: Date;
  periodEnd: Date;
  pdfR2Key: string | null;
  status: string; // PENDING | READY | FAILED
  generatedAt: Date | null;
  createdAt: Date;
}

export interface ReportRepository {
  create(report: ReportRecord): Promise<void>;
  findById(id: string, tenantId: string): Promise<ReportRecord | null>;
  listByTenant(tenantId: string, pagination: Pagination): Promise<PaginatedResult<ReportRecord>>;
}

export const REPORT_REPOSITORY = Symbol('ReportRepository');
