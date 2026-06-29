import { Inject, Injectable } from '@nestjs/common';
import {
  SaleOrderRepository,
  SALE_ORDER_REPOSITORY,
  SaleOrderSearchFilters,
  SaleOrderListItem,
} from '../../../../domain/repositories/sale-order.repository';
import { Pagination, PaginatedResult } from '../../../../domain/shared/pagination';

export interface SearchSaleOrdersInput extends SaleOrderSearchFilters {
  tenantId: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class SearchSaleOrdersUseCase {
  constructor(@Inject(SALE_ORDER_REPOSITORY) private readonly orderRepo: SaleOrderRepository) {}

  async execute(input: SearchSaleOrdersInput): Promise<PaginatedResult<SaleOrderListItem>> {
    const pagination: Pagination = { page: input.page ?? 1, pageSize: input.pageSize ?? 20 };
    return this.orderRepo.search(
      { status: input.status, customerId: input.customerId },
      input.tenantId,
      pagination,
    );
  }
}
