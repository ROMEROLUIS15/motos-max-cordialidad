import { WorkOrder } from '../entities/work-order.entity';
import { WorkOrderStatus } from '../value-objects/work-order-status.vo';
import { Pagination, PaginatedResult } from '../shared/pagination';

export interface WorkOrderFilters {
  status?: WorkOrderStatus;
  branchId?: string;
  technicianId?: string;
  from?: Date;
  to?: Date;
}

export interface StatusHistoryEntry {
  workOrderId: string;
  previousStatus: WorkOrderStatus | null;
  newStatus: WorkOrderStatus;
  changedBy: string;
  note: string | null;
  changedAt: Date;
}

export interface WorkOrderLineRecord {
  id: string;
  workOrderId: string;
  description: string;
  estimatedHours: number | null;
  unitPrice: number;
  technicianId: string | null;
  serviceCatalogId: string | null;
}

export interface WorkOrderPartRecord {
  id: string;
  workOrderId: string;
  partId: string;
  partName: string;
  partSku: string;
  quantity: number;
  unitPriceAtSale: number;
}

export interface WorkOrderWithDetails {
  workOrder: WorkOrder;
  lines: WorkOrderLineRecord[];
  parts: WorkOrderPartRecord[];
  statusHistory: StatusHistoryEntry[];
  total: number;
}

export interface WorkOrderRepository {
  findById(id: string, tenantId: string): Promise<WorkOrder | null>;
  findByIdWithDetails(id: string, tenantId: string): Promise<WorkOrderWithDetails | null>;
  findByBranch(
    branchId: string,
    tenantId: string,
    filters: WorkOrderFilters,
    pagination: Pagination,
  ): Promise<PaginatedResult<WorkOrder>>;
  findByTechnician(
    technicianId: string,
    tenantId: string,
    filters: WorkOrderFilters,
    pagination: Pagination,
  ): Promise<PaginatedResult<WorkOrder>>;
  findNearingDeadline(
    thresholdHours: number,
    tenantId: string,
    branchId?: string,
  ): Promise<WorkOrder[]>;
  countActiveByStatus(branchId: string, tenantId: string): Promise<Record<string, number>>;
  avgCycleTimeHours(branchId: string, tenantId: string, from: Date, to: Date): Promise<number>;
  technicianRanking(
    branchId: string,
    tenantId: string,
    from: Date,
    to: Date,
    limit: number,
  ): Promise<Array<{ technicianId: string; technicianName: string; completed: number }>>;
  countByStatusInPeriod(
    status: WorkOrderStatus,
    branchId: string,
    tenantId: string,
  ): Promise<number>;
  create(workOrder: WorkOrder): Promise<void>;
  save(workOrder: WorkOrder): Promise<void>;
  saveStatusHistory(entry: StatusHistoryEntry): Promise<void>;
  generateOrderNumber(tenantId: string, year: number): Promise<string>;

  // Service lines
  addLine(line: WorkOrderLineRecord): Promise<void>;
  updateLine(line: WorkOrderLineRecord): Promise<void>;
  removeLine(lineId: string, workOrderId: string): Promise<void>;
  findLineById(lineId: string, workOrderId: string): Promise<WorkOrderLineRecord | null>;

  // Parts
  addPart(part: WorkOrderPartRecord): Promise<void>;
  removePart(partId: string, workOrderId: string): Promise<void>;
  findPartById(id: string, workOrderId: string): Promise<WorkOrderPartRecord | null>;
}

export const WORK_ORDER_REPOSITORY = Symbol('WorkOrderRepository');
