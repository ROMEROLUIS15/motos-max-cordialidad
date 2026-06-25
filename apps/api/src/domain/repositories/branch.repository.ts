import { Branch } from '../entities/branch.entity';

export interface BranchRepository {
  findById(id: string, tenantId: string): Promise<Branch | null>;
  findByTenant(tenantId: string): Promise<Branch[]>;
  save(branch: Branch): Promise<void>;
  create(branch: Branch): Promise<void>;
}

export const BRANCH_REPOSITORY = Symbol('BranchRepository');
