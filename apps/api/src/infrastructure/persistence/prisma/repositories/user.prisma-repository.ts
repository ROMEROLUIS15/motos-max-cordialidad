import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UserRepository } from '../../../../domain/repositories/user.repository';
import { User } from '../../../../domain/entities/user.entity';

@Injectable()
export class UserPrismaRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, tenantId: string): Promise<User | null> {
    const r = await this.prisma.user.findFirst({ where: { id, tenantId } });
    return r ? this.toDomain(r) : null;
  }

  async findByEmail(email: string, tenantId: string): Promise<User | null> {
    const r = await this.prisma.user.findFirst({ where: { email, tenantId } });
    return r ? this.toDomain(r) : null;
  }

  async findByTenant(tenantId: string): Promise<User[]> {
    const records = await this.prisma.user.findMany({ where: { tenantId } });
    return records.map((r) => this.toDomain(r));
  }

  async findOwnerByWhatsappPhone(phone: string, tenantId: string): Promise<User | null> {
    const r = await this.prisma.user.findFirst({
      where: { tenantId, whatsappPhone: phone, isActive: true, role: { name: 'OWNER' } },
    });
    return r ? this.toDomain(r) : null;
  }

  async save(user: User): Promise<void> {
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        branchId: user.branchId,
        roleId: user.roleId,
        email: user.email,
        fullName: user.fullName,
        passwordHash: user.passwordHash,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        updatedAt: user.updatedAt,
      },
    });
  }

  async create(user: User): Promise<void> {
    await this.prisma.user.create({
      data: {
        id: user.id,
        tenantId: user.tenantId,
        branchId: user.branchId,
        roleId: user.roleId,
        email: user.email,
        passwordHash: user.passwordHash,
        fullName: user.fullName,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  }

  private toDomain(r: {
    id: string;
    tenantId: string;
    branchId: string | null;
    roleId: string;
    email: string;
    passwordHash: string;
    fullName: string;
    isActive: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): User {
    return new User(
      r.id,
      r.tenantId,
      r.branchId,
      r.roleId,
      r.email,
      r.passwordHash,
      r.fullName,
      r.isActive,
      r.lastLoginAt,
      r.createdAt,
      r.updatedAt,
    );
  }
}
