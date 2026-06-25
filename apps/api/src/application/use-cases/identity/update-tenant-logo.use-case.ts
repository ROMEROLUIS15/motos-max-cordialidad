import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TenantRepository, TENANT_REPOSITORY } from '../../../domain/repositories/tenant.repository';
import { StoragePort, STORAGE_PORT } from '../../ports/storage.port';
import { ImageProcessorService } from '../../../infrastructure/storage/image-processor.service';

export interface UpdateTenantLogoInput {
  tenantId: string;
  buffer: Buffer;
  mimeType: string;
}

@Injectable()
export class UpdateTenantLogoUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY) private readonly tenantRepo: TenantRepository,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly imageProcessor: ImageProcessorService,
  ) {}

  async execute(input: UpdateTenantLogoInput): Promise<{ logoUrl: string }> {
    const tenant = await this.tenantRepo.findById(input.tenantId);
    if (!tenant) throw new NotFoundException('Tenant no encontrado');

    const processed = await this.imageProcessor.process(input.buffer, input.mimeType);
    const key = `${input.tenantId}/logos/logo.${processed.extension}`;
    await this.storage.upload(key, processed.buffer, processed.contentType);

    // Delete the previous logo (the single case where physical R2 deletion is allowed).
    if (tenant.logoUrl && tenant.logoUrl !== key) {
      await this.storage.delete(tenant.logoUrl).catch(() => undefined);
    }

    tenant.updateLogo(key);
    await this.tenantRepo.save(tenant);
    return { logoUrl: key };
  }
}
