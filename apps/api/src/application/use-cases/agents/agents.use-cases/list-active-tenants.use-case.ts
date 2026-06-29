import { Inject, Injectable } from '@nestjs/common';
import {
  TenantRepository,
  TENANT_REPOSITORY,
} from '../../../../domain/repositories/tenant.repository';

@Injectable()
export class ListActiveTenantsUseCase {
  constructor(@Inject(TENANT_REPOSITORY) private readonly tenants: TenantRepository) {}

  async execute() {
    const tenants = await this.tenants.findActive();
    return tenants.map((t) => ({
      id: t.id,
      name: t.name,
      taxId: t.taxId,
      whatsappPhone: t.whatsappPhone,
    }));
  }
}
