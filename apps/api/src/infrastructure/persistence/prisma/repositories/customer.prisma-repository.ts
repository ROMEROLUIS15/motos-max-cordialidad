import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CustomerRepository, CustomerSearchParams, PaginatedResult } from '../../../../domain/repositories/customer.repository';
import { Customer, DocumentType } from '../../../../domain/entities/customer.entity';

@Injectable()
export class CustomerPrismaRepository implements CustomerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, tenantId: string): Promise<Customer | null> {
    const r = await this.prisma.customer.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    return r ? this.toDomain(r) : null;
  }

  async findByDocument(documentNumber: string, tenantId: string): Promise<Customer | null> {
    const r = await this.prisma.customer.findFirst({
      where: { documentNumber, tenantId, deletedAt: null },
    });
    return r ? this.toDomain(r) : null;
  }

  async search(params: CustomerSearchParams, tenantId: string): Promise<PaginatedResult<Customer>> {
    const { query, page, pageSize } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.CustomerWhereInput = {
      tenantId,
      deletedAt: null,
      ...(query && {
        OR: [
          { fullName: { contains: query, mode: 'insensitive' } },
          { documentNumber: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.customer.findMany({ where, skip, take: pageSize, orderBy: { createdAt: 'desc' } }),
      this.prisma.customer.count({ where }),
    ]);

    return { items: items.map((r) => this.toDomain(r)), total, page, pageSize };
  }

  async save(customer: Customer): Promise<void> {
    await this.prisma.customer.update({
      where: { id: customer.id },
      data: {
        fullName: customer.fullName,
        phone: customer.phone,
        whatsappPhone: customer.whatsappPhone,
        email: customer.email,
        address: customer.address,
        city: customer.city,
        birthDate: customer.birthDate,
        observations: customer.observations,
        isActive: customer.isActive,
        firstVisitAt: customer.firstVisitAt,
        lastVisitAt: customer.lastVisitAt,
        visitCount: customer.visitCount,
        deletedAt: customer.deletedAt,
        updatedAt: customer.updatedAt,
      },
    });
  }

  async create(customer: Customer): Promise<void> {
    await this.prisma.customer.create({
      data: {
        id: customer.id,
        tenantId: customer.tenantId,
        fullName: customer.fullName,
        documentType: customer.documentType,
        documentNumber: customer.documentNumber,
        phone: customer.phone,
        whatsappPhone: customer.whatsappPhone,
        email: customer.email,
        address: customer.address,
        city: customer.city,
        birthDate: customer.birthDate,
        observations: customer.observations,
        isActive: customer.isActive,
        firstVisitAt: customer.firstVisitAt,
        lastVisitAt: customer.lastVisitAt,
        visitCount: customer.visitCount,
        deletedAt: customer.deletedAt,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
      },
    });
  }

  private toDomain(r: {
    id: string; tenantId: string; fullName: string; documentType: string;
    documentNumber: string; phone: string; whatsappPhone: string | null;
    email: string | null; address: string | null; city: string;
    birthDate: Date | null; observations: string | null; isActive: boolean;
    firstVisitAt: Date | null; lastVisitAt: Date | null; visitCount: number;
    deletedAt: Date | null; createdAt: Date; updatedAt: Date;
  }): Customer {
    return new Customer(
      r.id, r.tenantId, r.fullName, r.documentType as DocumentType,
      r.documentNumber, r.phone, r.whatsappPhone, r.email, r.address,
      r.city, r.birthDate, r.observations, r.isActive, r.firstVisitAt,
      r.lastVisitAt, r.visitCount, r.deletedAt, r.createdAt, r.updatedAt,
    );
  }
}
