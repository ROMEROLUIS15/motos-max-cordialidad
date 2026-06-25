import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Branch } from '../../../domain/entities/branch.entity';
import { TenantRepository, TENANT_REPOSITORY } from '../../../domain/repositories/tenant.repository';
import { BranchRepository, BRANCH_REPOSITORY } from '../../../domain/repositories/branch.repository';

export interface CreateBranchInput {
  tenantId: string;
  name: string;
  address: string;
  phone?: string;
}

@Injectable()
export class CreateBranchUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY) private readonly tenantRepo: TenantRepository,
    @Inject(BRANCH_REPOSITORY) private readonly branchRepo: BranchRepository,
  ) {}

  async execute(input: CreateBranchInput): Promise<Branch> {
    const tenant = await this.tenantRepo.findById(input.tenantId);
    if (!tenant) throw new NotFoundException('Tenant not found');

    const now = new Date();
    const branch = new Branch(
      randomUUID(), input.tenantId, input.name,
      input.address, input.phone ?? null, true, now, now,
    );
    await this.branchRepo.create(branch);
    return branch;
  }
}
