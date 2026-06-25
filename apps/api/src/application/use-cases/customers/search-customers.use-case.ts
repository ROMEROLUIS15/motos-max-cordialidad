import { Inject, Injectable } from '@nestjs/common';
import { CustomerRepository, PaginatedResult, CUSTOMER_REPOSITORY } from '../../../domain/repositories/customer.repository';
import { Customer } from '../../../domain/entities/customer.entity';

export interface SearchCustomersInput {
  tenantId: string;
  query?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class SearchCustomersUseCase {
  constructor(@Inject(CUSTOMER_REPOSITORY) private readonly customerRepo: CustomerRepository) {}

  async execute(input: SearchCustomersInput): Promise<PaginatedResult<Customer>> {
    return this.customerRepo.search(
      { query: input.query, page: input.page ?? 1, pageSize: input.pageSize ?? 20 },
      input.tenantId,
    );
  }
}
