import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TenantRepository } from '../../../../domain/repositories/tenant.repository';
import { Tenant } from '../../../../domain/entities/tenant.entity';

@Injectable()
export class TenantPrismaRepository implements TenantRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Tenant | null> {
    const r = await this.prisma.tenant.findUnique({ where: { id } });
    return r ? this.toDomain(r) : null;
  }

  async findByTaxId(taxId: string): Promise<Tenant | null> {
    const r = await this.prisma.tenant.findUnique({ where: { taxId } });
    return r ? this.toDomain(r) : null;
  }

  async save(tenant: Tenant): Promise<void> {
    await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        name: tenant.name,
        logoUrl: tenant.logoUrl,
        address: tenant.address,
        phone: tenant.phone,
        email: tenant.email,
        vatPercentage: tenant.vatPercentage,
        accountingPeriodStart: tenant.accountingPeriodStart,
        whatsappPhone: tenant.whatsappPhone,
        whatsappToken: tenant.whatsappToken,
        businessHours: tenant.businessHours ?? undefined,
        termsAndConditions: tenant.termsAndConditions,
      },
    });
  }

  async create(tenant: Tenant): Promise<void> {
    await this.prisma.tenant.create({
      data: {
        id: tenant.id,
        name: tenant.name,
        taxId: tenant.taxId,
        logoUrl: tenant.logoUrl,
        address: tenant.address,
        phone: tenant.phone,
        email: tenant.email,
        vatPercentage: tenant.vatPercentage,
        accountingPeriodStart: tenant.accountingPeriodStart,
        whatsappPhone: tenant.whatsappPhone,
        whatsappToken: tenant.whatsappToken,
        businessHours: tenant.businessHours ?? undefined,
        termsAndConditions: tenant.termsAndConditions,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
      },
    });
  }

  private toDomain(r: {
    id: string; name: string; taxId: string; logoUrl: string | null;
    address: string | null; phone: string | null; email: string | null;
    vatPercentage: unknown; accountingPeriodStart: number;
    whatsappPhone: string | null; whatsappToken: string | null;
    businessHours: unknown; termsAndConditions: string | null;
    createdAt: Date; updatedAt: Date;
  }): Tenant {
    return new Tenant(
      r.id, r.name, r.taxId, r.logoUrl, r.address, r.phone, r.email,
      Number(r.vatPercentage), r.accountingPeriodStart,
      r.whatsappPhone, r.whatsappToken,
      (r.businessHours as Record<string, { open: string; close: string }>) ?? null,
      r.termsAndConditions, r.createdAt, r.updatedAt,
    );
  }
}
