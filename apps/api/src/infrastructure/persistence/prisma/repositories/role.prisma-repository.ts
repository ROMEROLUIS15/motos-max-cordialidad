import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service';
import { RoleRepository } from '../../../../domain/repositories/role.repository';
import { Role } from '../../../../domain/entities/role.entity';

@Injectable()
export class RolePrismaRepository implements RoleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, tenantId: string): Promise<Role | null> {
    const r = await this.prisma.role.findFirst({
      where: { id, tenantId },
      include: { permissions: true },
    });
    return r ? this.toDomain(r) : null;
  }

  async findByTenant(tenantId: string): Promise<Role[]> {
    const records = await this.prisma.role.findMany({
      where: { tenantId },
      include: { permissions: true },
    });
    return records.map((r) => this.toDomain(r));
  }

  async findByName(name: string, tenantId: string): Promise<Role | null> {
    const r = await this.prisma.role.findFirst({
      where: { name, tenantId },
      include: { permissions: true },
    });
    return r ? this.toDomain(r) : null;
  }

  async countUsersWithRole(roleId: string): Promise<number> {
    return this.prisma.user.count({ where: { roleId } });
  }

  async save(role: Role): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
      this.prisma.rolePermission.createMany({
        data: role.permissions.map((p) => ({
          id: p.id || randomUUID(),
          roleId: role.id,
          module: p.module,
          action: p.action,
        })),
      }),
    ]);
  }

  async create(role: Role): Promise<void> {
    await this.prisma.role.create({
      data: {
        id: role.id,
        tenantId: role.tenantId,
        name: role.name,
        isSystem: role.isSystem,
        createdAt: role.createdAt,
        permissions: {
          create: role.permissions.map((p) => ({
            id: p.id,
            module: p.module,
            action: p.action,
          })),
        },
      },
    });
  }

  async delete(roleId: string): Promise<void> {
    await this.prisma.role.delete({ where: { id: roleId } });
  }

  private toDomain(r: {
    id: string; tenantId: string; name: string; isSystem: boolean;
    createdAt: Date;
    permissions: Array<{ id: string; roleId: string; module: string; action: string }>;
  }): Role {
    return new Role(r.id, r.tenantId, r.name, r.isSystem, r.permissions, r.createdAt);
  }
}
