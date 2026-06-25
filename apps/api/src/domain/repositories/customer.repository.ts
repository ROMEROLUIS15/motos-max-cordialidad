import { Customer } from '../entities/customer.entity';

export interface CustomerSearchParams {
  query?: string;
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CustomerRepository {
  findById(id: string, tenantId: string): Promise<Customer | null>;
  findByDocument(documentNumber: string, tenantId: string): Promise<Customer | null>;
  search(params: CustomerSearchParams, tenantId: string): Promise<PaginatedResult<Customer>>;
  save(customer: Customer): Promise<void>;
  create(customer: Customer): Promise<void>;
}

export const CUSTOMER_REPOSITORY = Symbol('CustomerRepository');
