import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  WorkOrderRepository,
  WORK_ORDER_REPOSITORY,
  WorkOrderFilters,
  WorkOrderWithDetails,
  WorkOrderListItem,
} from '../../../domain/repositories/work-order.repository';
import { Pagination, PaginatedResult } from '../../../domain/shared/pagination';

@Injectable()
export class GetWorkOrderDetailUseCase {
  constructor(@Inject(WORK_ORDER_REPOSITORY) private readonly workOrderRepo: WorkOrderRepository) {}

  async execute(id: string, tenantId: string): Promise<WorkOrderWithDetails> {
    const details = await this.workOrderRepo.findByIdWithDetails(id, tenantId);
    if (!details) throw new NotFoundException('Orden de trabajo no encontrada');
    return details;
  }
}

export interface ListWorkOrdersInput extends WorkOrderFilters {
  tenantId: string;
  branchId: string;
  /** When set, restrict to this technician (TECHNICIAN role). */
  restrictToTechnicianId?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class ListWorkOrdersUseCase {
  constructor(@Inject(WORK_ORDER_REPOSITORY) private readonly workOrderRepo: WorkOrderRepository) {}

  async execute(input: ListWorkOrdersInput): Promise<PaginatedResult<WorkOrderListItem>> {
    const pagination: Pagination = { page: input.page ?? 1, pageSize: input.pageSize ?? 20 };
    const filters: WorkOrderFilters = {
      status: input.status,
      technicianId: input.technicianId,
      from: input.from,
      to: input.to,
      search: input.search,
    };

    if (input.restrictToTechnicianId) {
      return this.workOrderRepo.findByTechnician(
        input.restrictToTechnicianId,
        input.tenantId,
        filters,
        pagination,
      );
    }
    return this.workOrderRepo.findByBranch(input.branchId, input.tenantId, filters, pagination);
  }
}
