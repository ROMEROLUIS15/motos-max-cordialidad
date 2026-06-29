import { Inject, Injectable } from '@nestjs/common';
import { MotorcycleUnit } from '../../../../domain/entities/motorcycle-unit.entity';
import {
  MotorcycleUnitRepository,
  MOTORCYCLE_UNIT_REPOSITORY,
  MotorcycleUnitSearchFilters,
} from '../../../../domain/repositories/motorcycle-unit.repository';
import { Pagination, PaginatedResult } from '../../../../domain/shared/pagination';

export interface SearchMotorcycleUnitsInput extends MotorcycleUnitSearchFilters {
  tenantId: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class SearchMotorcycleUnitsUseCase {
  constructor(
    @Inject(MOTORCYCLE_UNIT_REPOSITORY) private readonly repo: MotorcycleUnitRepository,
  ) {}

  async execute(input: SearchMotorcycleUnitsInput): Promise<PaginatedResult<MotorcycleUnit>> {
    const pagination: Pagination = { page: input.page ?? 1, pageSize: input.pageSize ?? 20 };
    return this.repo.search(
      {
        query: input.query,
        status: input.status,
        condition: input.condition,
        branchId: input.branchId,
      },
      input.tenantId,
      pagination,
    );
  }
}
