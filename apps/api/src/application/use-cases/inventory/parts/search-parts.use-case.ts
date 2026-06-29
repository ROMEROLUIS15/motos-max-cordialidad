import { Inject, Injectable } from '@nestjs/common';
import {
  PartRepository,
  PART_REPOSITORY,
  PartSearchFilters,
  PartWithStock,
} from '../../../../domain/repositories/part.repository';
import { Pagination, PaginatedResult } from '../../../../domain/shared/pagination';

export interface SearchPartsInput extends PartSearchFilters {
  tenantId: string;
  branchId: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class SearchPartsUseCase {
  constructor(@Inject(PART_REPOSITORY) private readonly partRepo: PartRepository) {}

  async execute(input: SearchPartsInput): Promise<PaginatedResult<PartWithStock>> {
    const pagination: Pagination = { page: input.page ?? 1, pageSize: input.pageSize ?? 20 };
    return this.partRepo.searchWithStock(
      { query: input.query, category: input.category },
      input.tenantId,
      input.branchId,
      pagination,
    );
  }
}
