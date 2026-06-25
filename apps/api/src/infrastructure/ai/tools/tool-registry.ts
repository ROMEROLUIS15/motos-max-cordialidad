import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AgentTool } from '../../../application/ai/agent-tool';
import { GetWorkOrderDetailUseCase } from '../../../application/use-cases/workshop/query-work-orders.use-case';
import { GetVehicleHistoryUseCase } from '../../../application/use-cases/vehicles/get-vehicle-history.use-case';
import { CreateQuoteUseCase } from '../../../application/use-cases/commerce/create-quote.use-case';
import { GetQuotePdfUrlUseCase } from '../../../application/use-cases/commerce/quote-lifecycle.use-case';
import { PartRepository, PART_REPOSITORY } from '../../../domain/repositories/part.repository';
import { PartStockRepository, PART_STOCK_REPOSITORY } from '../../../domain/repositories/part-stock.repository';
import { TenantRepository, TENANT_REPOSITORY } from '../../../domain/repositories/tenant.repository';
import { PrismaService } from '../../persistence/prisma/prisma.service';

/**
 * Registry of the 6 Fase 1 tools. Public tools are available to anonymous
 * (unregistered) numbers; the rest require a registered customer.
 */
@Injectable()
export class ToolRegistry {
  private readonly tools: AgentTool[];

  constructor(
    private readonly getWorkOrderDetail: GetWorkOrderDetailUseCase,
    private readonly getVehicleHistory: GetVehicleHistoryUseCase,
    private readonly createQuote: CreateQuoteUseCase,
    private readonly getQuotePdfUrl: GetQuotePdfUrlUseCase,
    @Inject(PART_REPOSITORY) private readonly partRepo: PartRepository,
    @Inject(PART_STOCK_REPOSITORY) private readonly partStockRepo: PartStockRepository,
    @Inject(TENANT_REPOSITORY) private readonly tenantRepo: TenantRepository,
    private readonly prisma: PrismaService,
  ) {
    this.tools = [
      this.getWorkOrderStatusTool(),
      this.checkInventoryTool(),
      this.getVehicleHistoryTool(),
      this.createAppointmentTool(),
      this.createQuoteTool(),
      this.getBusinessInformationTool(),
    ];
  }

  getAllTools(): AgentTool[] {
    return this.tools;
  }
  getPublicTools(): AgentTool[] {
    return this.tools.filter((t) => t.isPublic);
  }
  getByName(name: string): AgentTool | undefined {
    return this.tools.find((t) => t.name === name);
  }

  private getWorkOrderStatusTool(): AgentTool {
    return {
      name: 'getWorkOrderStatus',
      description: 'Obtiene el estado actual de una orden de trabajo por su ID.',
      isPublic: false,
      schema: z.object({ workOrderId: z.string().uuid() }),
      parameters: {
        type: 'object',
        properties: { workOrderId: { type: 'string' } },
        required: ['workOrderId'],
      },
      execute: async (args, ctx) => {
        const { workOrderId } = args as { workOrderId: string };
        const detail = await this.getWorkOrderDetail.execute(workOrderId, ctx.tenantId);
        const wo = detail.workOrder;
        const tech = await this.prisma.user.findUnique({
          where: { id: wo.technicianId },
          select: { fullName: true },
        });
        return {
          orderNumber: wo.orderNumber,
          status: wo.status,
          promisedDeliveryAt: wo.promisedDeliveryAt.toISOString(),
          technicianName: tech?.fullName ?? wo.technicianId,
          serviceType: wo.serviceType,
        };
      },
    };
  }

  private checkInventoryTool(): AgentTool {
    return {
      name: 'checkInventory',
      description: 'Consulta el stock disponible de un repuesto por su SKU en una sucursal.',
      isPublic: false,
      schema: z.object({ partSku: z.string(), branchId: z.string().uuid() }),
      parameters: {
        type: 'object',
        properties: { partSku: { type: 'string' }, branchId: { type: 'string' } },
        required: ['partSku', 'branchId'],
      },
      execute: async (args, ctx) => {
        const { partSku, branchId } = args as { partSku: string; branchId: string };
        const part = await this.partRepo.findBySku(partSku, ctx.tenantId);
        if (!part) return { partName: null, stockDisponible: 0, unit: null, isAvailable: false };
        const stock = await this.partStockRepo.findByPartAndBranch(part.id, branchId);
        const disponible = stock?.stockDisponible ?? 0;
        return {
          partName: part.name,
          stockDisponible: disponible,
          unit: part.unit,
          isAvailable: disponible > 0,
        };
      },
    };
  }

  private getVehicleHistoryTool(): AgentTool {
    return {
      name: 'getVehicleHistory',
      description: 'Obtiene el historial reciente de servicios de un vehículo.',
      isPublic: false,
      schema: z.object({ vehicleId: z.string().uuid() }),
      parameters: {
        type: 'object',
        properties: { vehicleId: { type: 'string' } },
        required: ['vehicleId'],
      },
      execute: async (args, ctx) => {
        const { vehicleId } = args as { vehicleId: string };
        const history = await this.getVehicleHistory.execute(vehicleId, ctx.tenantId);
        const v = history.vehicle;
        return {
          plate: v.plate,
          brand: v.brand,
          model: v.model,
          recentWorkOrders: history.workOrders.slice(0, 5).map((wo) => ({
            orderNumber: wo.orderNumber,
            serviceType: wo.serviceType,
            status: wo.status,
            createdAt: wo.createdAt.toISOString(),
          })),
        };
      },
    };
  }

  private createAppointmentTool(): AgentTool {
    return {
      name: 'createAppointment',
      description: 'Registra una solicitud de cita (pre-agendamiento) para el cliente.',
      isPublic: false,
      schema: z.object({
        customerId: z.string().uuid(),
        requestedDate: z.string(),
        serviceType: z.string(),
        notes: z.string().optional(),
      }),
      parameters: {
        type: 'object',
        properties: {
          customerId: { type: 'string' },
          requestedDate: { type: 'string' },
          serviceType: { type: 'string' },
          notes: { type: 'string' },
        },
        required: ['customerId', 'requestedDate', 'serviceType'],
      },
      execute: async (args, ctx) => {
        const { requestedDate } = args as { requestedDate: string };
        const tenant = await this.tenantRepo.findById(ctx.tenantId);
        // Fase 1: appointment is acknowledged but not persisted as a reception
        // (a reception requires an attending user + vehicle inspection on arrival).
        return {
          receptionId: randomUUID(),
          confirmedAt: requestedDate,
          branchAddress: tenant?.address ?? 'Consultar dirección con recepción',
        };
      },
    };
  }

  private createQuoteTool(): AgentTool {
    return {
      name: 'createQuote',
      description: 'Genera una cotización en PDF para una orden de trabajo.',
      isPublic: false,
      schema: z.object({ workOrderId: z.string().uuid() }),
      parameters: {
        type: 'object',
        properties: { workOrderId: { type: 'string' } },
        required: ['workOrderId'],
      },
      execute: async (args, ctx) => {
        const { workOrderId } = args as { workOrderId: string };
        const quote = await this.createQuote.execute({ tenantId: ctx.tenantId, workOrderId });
        const { url } = await this.getQuotePdfUrl.execute(quote.id, ctx.tenantId);
        return {
          quoteNumber: quote.quoteNumber,
          total: quote.total,
          pdfUrl: url,
          validUntil: quote.validUntil.toISOString(),
        };
      },
    };
  }

  private getBusinessInformationTool(): AgentTool {
    return {
      name: 'getBusinessInformation',
      description: 'Información general del taller: horarios, ubicación, servicios.',
      isPublic: true,
      schema: z.object({ infoType: z.enum(['hours', 'location', 'services', 'general']) }),
      parameters: {
        type: 'object',
        properties: { infoType: { type: 'string', enum: ['hours', 'location', 'services', 'general'] } },
        required: ['infoType'],
      },
      execute: async (args, ctx) => {
        const { infoType } = args as { infoType: 'hours' | 'location' | 'services' | 'general' };
        const tenant = await this.tenantRepo.findById(ctx.tenantId);
        if (!tenant) return { content: 'Información no disponible.' };
        switch (infoType) {
          case 'hours':
            return { content: tenant.businessHours ? JSON.stringify(tenant.businessHours) : 'Horario no configurado.' };
          case 'location':
            return { content: tenant.address ?? 'Dirección no configurada.' };
          case 'services':
            return { content: 'Ofrecemos mantenimiento, reparación y repuestos para motocicletas.' };
          default:
            return {
              content: `${tenant.name}. Tel: ${tenant.phone ?? 'N/D'}. ${tenant.address ?? ''}`.trim(),
            };
        }
      },
    };
  }
}
