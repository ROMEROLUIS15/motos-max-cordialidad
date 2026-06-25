import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  WorkOrderRepository,
  WORK_ORDER_REPOSITORY,
  WorkOrderWithDetails,
} from '../../../domain/repositories/work-order.repository';
import { TenantRepository, TENANT_REPOSITORY } from '../../../domain/repositories/tenant.repository';
import { QuotePdfData } from '../../ports/pdf-generator.port';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

export interface AssembledQuote {
  details: WorkOrderWithDetails;
  pdfData: QuotePdfData;
  subtotal: number;
  vatPercentage: number;
  vatAmount: number;
  total: number;
}

/**
 * Reads a work order + tenant/customer/vehicle data and assembles the data
 * needed both to persist a Quote and to render its PDF.
 */
@Injectable()
export class QuoteAssembler {
  constructor(
    @Inject(WORK_ORDER_REPOSITORY) private readonly workOrderRepo: WorkOrderRepository,
    @Inject(TENANT_REPOSITORY) private readonly tenantRepo: TenantRepository,
    private readonly prisma: PrismaService,
  ) {}

  async assemble(workOrderId: string, tenantId: string, validUntil: Date): Promise<AssembledQuote> {
    const details = await this.workOrderRepo.findByIdWithDetails(workOrderId, tenantId);
    if (!details) throw new NotFoundException('Orden de trabajo no encontrada');

    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) throw new NotFoundException('Tenant no encontrado');

    const [customer, vehicle, partNames] = await Promise.all([
      this.prisma.customer.findUnique({
        where: { id: details.workOrder.customerId },
        select: { fullName: true, documentNumber: true },
      }),
      this.prisma.vehicle.findUnique({
        where: { id: details.workOrder.vehicleId },
        select: { plate: true, brand: true, model: true },
      }),
      this.prisma.part.findMany({
        where: { id: { in: details.parts.map((p) => p.partId) } },
        select: { id: true, name: true },
      }),
    ]);

    const nameById = new Map(partNames.map((p) => [p.id, p.name]));

    const subtotal = details.total;
    const vatPercentage = tenant.vatPercentage;
    const vatAmount = Math.round(subtotal * vatPercentage) / 100;
    const total = subtotal + vatAmount;

    const pdfData: QuotePdfData = {
      quoteNumber: '',
      issuedAt: new Date(),
      validUntil,
      tenant: {
        name: tenant.name,
        logoUrl: tenant.logoUrl,
        address: tenant.address,
        phone: tenant.phone,
        taxId: tenant.taxId,
      },
      customer: {
        fullName: customer?.fullName ?? '—',
        documentNumber: customer?.documentNumber ?? '—',
      },
      vehicle: {
        plate: vehicle?.plate ?? '—',
        brand: vehicle?.brand ?? '',
        model: vehicle?.model ?? '',
      },
      services: details.lines.map((l) => ({
        description: l.description,
        quantity: 1,
        unitPrice: l.unitPrice,
        total: l.unitPrice,
      })),
      parts: details.parts.map((p) => ({
        description: nameById.get(p.partId) ?? p.partId,
        quantity: p.quantity,
        unitPrice: p.unitPriceAtSale,
        total: p.quantity * p.unitPriceAtSale,
      })),
      subtotal,
      vatPercentage,
      vatAmount,
      total,
      termsConditions: tenant.termsAndConditions,
    };

    return { details, pdfData, subtotal, vatPercentage, vatAmount, total };
  }
}
