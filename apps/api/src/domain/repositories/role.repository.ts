import { Role } from '../entities/role.entity';

export interface RoleRepository {
  findById(id: string, tenantId: string): Promise<Role | null>;
  findByTenant(tenantId: string): Promise<Role[]>;
  findByName(name: string, tenantId: string): Promise<Role | null>;
  countUsersWithRole(roleId: string): Promise<number>;
  save(role: Role): Promise<void>;
  create(role: Role): Promise<void>;
  delete(roleId: string): Promise<void>;
}

export const ROLE_REPOSITORY = Symbol('RoleRepository');
