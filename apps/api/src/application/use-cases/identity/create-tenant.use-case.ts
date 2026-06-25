import { Inject, Injectable, ConflictException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Tenant } from '../../../domain/entities/tenant.entity';
import { Branch } from '../../../domain/entities/branch.entity';
import { TenantRepository, TENANT_REPOSITORY } from '../../../domain/repositories/tenant.repository';
import { BranchRepository, BRANCH_REPOSITORY } from '../../../domain/repositories/branch.repository';

export interface CreateTenantInput {
  name: string;
  taxId: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface CreateTenantOutput {
  tenantId: string;
  branchId: string;
}

@Injectable()
export class CreateTenantUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY) private readonly tenantRepo: TenantRepository,
    @Inject(BRANCH_REPOSITORY) private readonly branchRepo: BranchRepository,
  ) {}

  async execute(input: CreateTenantInput): Promise<CreateTenantOutput> {
    const existing = await this.tenantRepo.findByTaxId(input.taxId);
    if (existing) {
      throw new ConflictException(`Tenant with taxId ${input.taxId} already exists`);
    }

    const now = new Date();
    const tenantId = randomUUID();
    const tenant = new Tenant(
      tenantId, input.name, input.taxId, null,
      input.address ?? null, input.phone ?? null, input.email ?? null,
      19.0, 1, null, null, null, null, now, now,
    );

    const branchId = randomUUID();
    const branch = new Branch(
      branchId, tenantId, 'Principal',
      input.address ?? 'Por configurar',
      input.phone ?? null, true, now, now,
    );

    await this.tenantRepo.create(tenant);
    await this.branchRepo.create(branch);

    return { tenantId, branchId };
  }
}
