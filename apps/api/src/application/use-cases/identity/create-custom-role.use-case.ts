import { Inject, Injectable, ConflictException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Role } from '../../../domain/entities/role.entity';
import { RoleRepository, ROLE_REPOSITORY } from '../../../domain/repositories/role.repository';
import { PermissionGuard } from '../../../presentation/http/guards/permission.guard';

export interface CreateCustomRoleInput {
  tenantId: string;
  requestingUserId: string;
  name: string;
  permissions: Array<{ module: string; action: string }>;
}

export interface UpdateRolePermissionsInput {
  roleId: string;
  tenantId: string;
  permissions: Array<{ module: string; action: string }>;
}

@Injectable()
export class CreateCustomRoleUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY) private readonly roleRepo: RoleRepository,
    private readonly permissionGuard: PermissionGuard,
  ) {}

  async execute(input: CreateCustomRoleInput): Promise<Role> {
    const existing = await this.roleRepo.findByName(input.name, input.tenantId);
    if (existing) throw new ConflictException(`Role '${input.name}' already exists`);

    const roleId = randomUUID();
    const perms = input.permissions.map((p) => ({
      id: randomUUID(), roleId, module: p.module, action: p.action,
    }));
    const role = new Role(roleId, input.tenantId, input.name, false, perms, new Date());
    await this.roleRepo.create(role);
    return role;
  }
}

@Injectable()
export class UpdateRolePermissionsUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY) private readonly roleRepo: RoleRepository,
    private readonly permissionGuard: PermissionGuard,
  ) {}

  async execute(input: UpdateRolePermissionsInput): Promise<void> {
    const role = await this.roleRepo.findById(input.roleId, input.tenantId);
    if (!role) throw new Error('Role not found');

    role.permissions = input.permissions.map((p) => ({
      id: randomUUID(), roleId: input.roleId, module: p.module, action: p.action,
    }));
    await this.roleRepo.save(role);
    this.permissionGuard.invalidateRoleCache(input.roleId);
  }
}
