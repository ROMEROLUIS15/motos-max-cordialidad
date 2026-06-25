import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TenantConfig } from '../../../domain/entities/tenant.entity';
import { TenantRepository, TENANT_REPOSITORY } from '../../../domain/repositories/tenant.repository';
import { FieldEncryptionService } from '../../../infrastructure/crypto/field-encryption.service';

export interface UpdateTenantConfigInput extends TenantConfig {
  tenantId: string;
}

@Injectable()
export class UpdateTenantConfigUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY) private readonly tenantRepo: TenantRepository,
    private readonly encryptionService: FieldEncryptionService,
  ) {}

  async execute(input: UpdateTenantConfigInput): Promise<void> {
    const tenant = await this.tenantRepo.findById(input.tenantId);
    if (!tenant) throw new NotFoundException('Tenant not found');

    const { tenantId: _id, ...config } = input;

    if (config.whatsappToken) {
      config.whatsappToken = this.encryptionService.encrypt(config.whatsappToken);
    }

    tenant.updateConfig(config);
    await this.tenantRepo.save(tenant);
  }
}
