import { Tenant } from '../entities/tenant.entity';

export interface TenantRepository {
  findById(id: string): Promise<Tenant | null>;
  findByTaxId(taxId: string): Promise<Tenant | null>;
  save(tenant: Tenant): Promise<void>;
  create(tenant: Tenant): Promise<void>;
}

export const TENANT_REPOSITORY = Symbol('TenantRepository');
