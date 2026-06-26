import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ServiceAuthGuard } from '../guards/service-auth.guard';
import {
  ListActiveTenantsUseCase,
  GetAgentsDashboardSummaryUseCase,
  GetAgentsInventoryStatusUseCase,
  CreatePurchaseOrderDraftUseCase,
  CreateStockAlertUseCase,
  GetPendingWorkOrdersUseCase,
  RecordReportUseCase,
  GenerateReportUseCase,
  SendOwnerWhatsAppUseCase,
} from '../../../application/use-cases/agents/agents.use-cases';
import { PurchaseOrderDraftItem } from '../../../domain/repositories/purchase-order-draft.repository';

const SERVICE_ACTOR = 'agents-service';

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new BadRequestException(`${field} is required`);
  }
  return value;
}

function requireDate(value: unknown, field: string): Date {
  const raw = requireString(value, field);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new BadRequestException(`${field} is not a valid date`);
  return d;
}

interface PurchaseOrderDraftBody {
  tenantId: string;
  items: PurchaseOrderDraftItem[];
  notes?: string;
}

interface StockAlertBody {
  tenantId: string;
  partId: string;
  partName: string;
  currentStock: number;
  minStock: number;
}

interface ReportBody {
  tenantId: string;
  type: string;
  periodStart: string;
  periodEnd: string;
  pdfR2Key?: string;
}

interface WhatsAppBody {
  tenantId: string;
  content: string;
}

/**
 * Service-to-service surface for the Python agents microservice (Fase 2A).
 * Every endpoint is protected by ServiceAuthGuard (JWT with type:"service").
 * The tenantId is always explicit per request — service tokens carry no tenant.
 */
@Controller('agents')
@UseGuards(ServiceAuthGuard)
export class AgentsController {
  constructor(
    private readonly listTenants: ListActiveTenantsUseCase,
    private readonly dashboard: GetAgentsDashboardSummaryUseCase,
    private readonly inventory: GetAgentsInventoryStatusUseCase,
    private readonly createDraft: CreatePurchaseOrderDraftUseCase,
    private readonly stockAlert: CreateStockAlertUseCase,
    private readonly pendingWorkOrders: GetPendingWorkOrdersUseCase,
    private readonly recordReport: RecordReportUseCase,
    private readonly generateReport: GenerateReportUseCase,
    private readonly ownerWhatsApp: SendOwnerWhatsAppUseCase,
  ) {}

  @Get('tenants')
  async tenants() {
    return this.listTenants.execute();
  }

  @Get('dashboard/summary')
  async dashboardSummary(
    @Query('tenantId') tenantId: string,
    @Query('periodStart') periodStart: string,
    @Query('periodEnd') periodEnd: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.dashboard.execute({
      tenantId: requireString(tenantId, 'tenantId'),
      from: requireDate(periodStart, 'periodStart'),
      to: requireDate(periodEnd, 'periodEnd'),
      branchId: branchId || undefined,
    });
  }

  @Get('inventory/status')
  async inventoryStatus(
    @Query('tenantId') tenantId: string,
    @Query('branchId') branchId?: string,
    @Query('daysLookback') daysLookback?: string,
  ) {
    return this.inventory.execute({
      tenantId: requireString(tenantId, 'tenantId'),
      branchId: branchId || undefined,
      daysLookback: daysLookback ? Number(daysLookback) : undefined,
    });
  }

  @Post('purchase-orders/draft')
  async purchaseOrderDraft(@Body() body: PurchaseOrderDraftBody) {
    const tenantId = requireString(body?.tenantId, 'tenantId');
    if (!Array.isArray(body?.items) || body.items.length === 0) {
      throw new BadRequestException('items must be a non-empty array');
    }
    for (const item of body.items) {
      requireString(item?.partId, 'items[].partId');
      if (typeof item?.quantity !== 'number' || item.quantity <= 0) {
        throw new BadRequestException('items[].quantity must be a positive number');
      }
    }
    return this.createDraft.execute({
      tenantId,
      items: body.items,
      notes: body.notes,
      createdBy: SERVICE_ACTOR,
    });
  }

  @Post('notifications/stock-alert')
  async notifyStockAlert(@Body() body: StockAlertBody) {
    return this.stockAlert.execute({
      tenantId: requireString(body?.tenantId, 'tenantId'),
      partId: requireString(body?.partId, 'partId'),
      partName: requireString(body?.partName, 'partName'),
      currentStock: Number(body?.currentStock ?? 0),
      minStock: Number(body?.minStock ?? 0),
    });
  }

  @Get('work-orders/pending')
  async workOrdersPending(
    @Query('tenantId') tenantId: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.pendingWorkOrders.execute(
      requireString(tenantId, 'tenantId'),
      branchId || undefined,
    );
  }

  @Post('reports')
  async reports(@Body() body: ReportBody) {
    return this.recordReport.execute({
      tenantId: requireString(body?.tenantId, 'tenantId'),
      type: requireString(body?.type, 'type'),
      periodStart: requireDate(body?.periodStart, 'periodStart'),
      periodEnd: requireDate(body?.periodEnd, 'periodEnd'),
      pdfR2Key: requireString(body?.pdfR2Key, 'pdfR2Key'),
    });
  }

  @Post('reports/generate')
  async reportsGenerate(@Body() body: ReportBody) {
    return this.generateReport.execute({
      tenantId: requireString(body?.tenantId, 'tenantId'),
      type: requireString(body?.type, 'type'),
      periodStart: requireDate(body?.periodStart, 'periodStart'),
      periodEnd: requireDate(body?.periodEnd, 'periodEnd'),
    });
  }

  @Post('notifications/whatsapp')
  async notifyWhatsApp(@Body() body: WhatsAppBody) {
    return this.ownerWhatsApp.execute(
      requireString(body?.tenantId, 'tenantId'),
      requireString(body?.content, 'content'),
    );
  }
}
