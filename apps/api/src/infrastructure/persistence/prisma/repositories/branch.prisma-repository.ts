import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BranchRepository } from '../../../../domain/repositories/branch.repository';
import { Branch } from '../../../../domain/entities/branch.entity';

@Injectable()
export class BranchPrismaRepository implements BranchRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, tenantId: string): Promise<Branch | null> {
    const r = await this.prisma.branch.findFirst({ where: { id, tenantId } });
    return r ? this.toDomain(r) : null;
  }

  async findByTenant(tenantId: string): Promise<Branch[]> {
    const records = await this.prisma.branch.findMany({ where: { tenantId } });
    return records.map((r) => this.toDomain(r));
  }

  async save(branch: Branch): Promise<void> {
    await this.prisma.branch.update({
      where: { id: branch.id },
      data: {
        name: branch.name,
        address: branch.address,
        phone: branch.phone,
        isActive: branch.isActive,
        updatedAt: branch.updatedAt,
      },
    });
  }

  async create(branch: Branch): Promise<void> {
    await this.prisma.branch.create({
      data: {
        id: branch.id,
        tenantId: branch.tenantId,
        name: branch.name,
        address: branch.address,
        phone: branch.phone,
        isActive: branch.isActive,
        createdAt: branch.createdAt,
        updatedAt: branch.updatedAt,
      },
    });
  }

  private toDomain(r: {
    id: string; tenantId: string; name: string; address: string;
    phone: string | null; isActive: boolean; createdAt: Date; updatedAt: Date;
  }): Branch {
    return new Branch(r.id, r.tenantId, r.name, r.address, r.phone, r.isActive, r.createdAt, r.updatedAt);
  }
}
