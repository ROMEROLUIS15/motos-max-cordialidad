import { Tenant } from '../entities/tenant.entity';

export interface TenantRepository {
  findById(id: string): Promise<Tenant | null>;
  findByTaxId(taxId: string): Promise<Tenant | null>;
  save(tenant: Tenant): Promise<void>;
  create(tenant: Tenant): Promise<void>;
  /**
   * Active tenants consumed by the agents microservice (cron jobs iterate
   * these). There is no `status` column yet, so every tenant is considered
   * active; the method exists so callers don't depend on that detail.
   */
  findActive(): Promise<Tenant[]>;
}

export const TENANT_REPOSITORY = Symbol('TenantRepository');
