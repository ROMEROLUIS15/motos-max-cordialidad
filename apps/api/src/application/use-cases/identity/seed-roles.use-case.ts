import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Role, SystemRole, SYSTEM_ROLE_PERMISSIONS } from '../../../domain/entities/role.entity';
import { RoleRepository, ROLE_REPOSITORY } from '../../../domain/repositories/role.repository';

@Injectable()
export class SeedRolesUseCase {
  constructor(@Inject(ROLE_REPOSITORY) private readonly roleRepo: RoleRepository) {}

  async execute(tenantId: string): Promise<Record<SystemRole, string>> {
    const roleIds: Partial<Record<SystemRole, string>> = {};

    for (const roleName of Object.values(SystemRole)) {
      const existing = await this.roleRepo.findByName(roleName, tenantId);
      if (existing) {
        roleIds[roleName] = existing.id;
        continue;
      }
      const roleId = randomUUID();
      const perms = SYSTEM_ROLE_PERMISSIONS[roleName].map((p) => ({
        id: randomUUID(),
        roleId,
        module: p.module,
        action: p.action,
      }));
      const role = new Role(roleId, tenantId, roleName, true, perms, new Date());
      await this.roleRepo.create(role);
      roleIds[roleName] = roleId;
    }

    return roleIds as Record<SystemRole, string>;
  }
}
