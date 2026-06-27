import { Pagination, PaginatedResult } from '../shared/pagination';

export interface HomeServiceRequestRecord {
  id: string;
  tenantId: string;
  branchId: string | null;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  address: string;
  problemDesc: string;
  serviceType: string;
  status: string; // PENDING | ASSIGNED | IN_PROGRESS | COMPLETED | CANCELLED
  assignedTo: string | null;
  workOrderId: string | null;
  estimatedCost: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface HomeServiceFilters {
  status?: string;
}

export interface HomeServiceUpdate {
  status?: string;
  assignedTo?: string | null;
}

export interface HomeServiceRequestRepository {
  create(record: HomeServiceRequestRecord): Promise<void>;
  findById(id: string, tenantId: string): Promise<HomeServiceRequestRecord | null>;
  list(
    tenantId: string,
    filters: HomeServiceFilters,
    pagination: Pagination,
  ): Promise<PaginatedResult<HomeServiceRequestRecord>>;
  update(
    id: string,
    tenantId: string,
    patch: HomeServiceUpdate,
  ): Promise<HomeServiceRequestRecord | null>;
}

export const HOME_SERVICE_REQUEST_REPOSITORY = Symbol('HomeServiceRequestRepository');
