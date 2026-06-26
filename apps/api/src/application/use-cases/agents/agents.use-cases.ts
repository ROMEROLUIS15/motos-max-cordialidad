import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  TenantRepository,
  TENANT_REPOSITORY,
} from '../../../domain/repositories/tenant.repository';
import {
  PaymentRepository,
  PAYMENT_REPOSITORY,
} from '../../../domain/repositories/payment.repository';
import {
  WorkOrderRepository,
  WORK_ORDER_REPOSITORY,
} from '../../../domain/repositories/work-order.repository';
import {
  PartStockRepository,
  PART_STOCK_REPOSITORY,
} from '../../../domain/repositories/part-stock.repository';
import {
  StockEntryRepository,
  STOCK_ENTRY_REPOSITORY,
} from '../../../domain/repositories/stock-entry.repository';
import {
  ReportRepository,
  REPORT_REPOSITORY,
  ReportRecord,
} from '../../../domain/repositories/report.repository';
import {
  PurchaseOrderDraftRepository,
  PURCHASE_ORDER_DRAFT_REPOSITORY,
  PurchaseOrderDraftItem,
} from '../../../domain/repositories/purchase-order-draft.repository';
import {
  NotificationRepository,
  NOTIFICATION_REPOSITORY,
} from '../../../domain/repositories/notification.repository';
import { NotificationPort, NOTIFICATION_PORT } from '../../ports/notification.port';
import { MessagingPort, MESSAGING_PORT } from '../../ports/messaging.port';
import { StoragePort, STORAGE_PORT } from '../../ports/storage.port';
import { Pagination } from '../../../domain/shared/pagination';

const REPORT_URL_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

@Injectable()
export class ListActiveTenantsUseCase {
  constructor(@Inject(TENANT_REPOSITORY) private readonly tenants: TenantRepository) {}

  async execute() {
    const tenants = await this.tenants.findActive();
    return tenants.map((t) => ({
      id: t.id,
      name: t.name,
      taxId: t.taxId,
      whatsappPhone: t.whatsappPhone,
    }));
  }
}

export interface AgentsDashboardInput {
  tenantId: string;
  from: Date;
  to: Date;
  branchId?: string;
}

@Injectable()
export class GetAgentsDashboardSummaryUseCase {
  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository,
    @Inject(WORK_ORDER_REPOSITORY) private readonly workOrders: WorkOrderRepository,
  ) {}

  async execute(input: AgentsDashboardInput) {
    const { tenantId, from, to, branchId } = input;
    const [totalIncome, completedOrders] = await Promise.all([
      this.payments.sumByTenantAndPeriod(tenantId, from, to, branchId),
      this.workOrders.countCompletedInPeriod(tenantId, from, to, branchId),
    ]);
    const avgTicket =
      completedOrders > 0 ? Math.round((totalIncome / completedOrders) * 100) / 100 : 0;
    return {
      tenantId,
      periodStart: from.toISOString(),
      periodEnd: to.toISOString(),
      totalIncome,
      completedOrders,
      avgTicket,
    };
  }
}

export interface AgentsInventoryInput {
  tenantId: string;
  branchId?: string;
  daysLookback?: number;
}

@Injectable()
export class GetAgentsInventoryStatusUseCase {
  constructor(
    @Inject(PART_STOCK_REPOSITORY) private readonly stock: PartStockRepository,
    @Inject(STOCK_ENTRY_REPOSITORY) private readonly entries: StockEntryRepository,
  ) {}

  async execute(input: AgentsInventoryInput) {
    const daysLookback = input.daysLookback && input.daysLookback > 0 ? input.daysLookback : 30;
    const to = new Date();
    const from = new Date(to.getTime() - daysLookback * 24 * 60 * 60 * 1000);

    const [lowStock, consumption] = await Promise.all([
      this.stock.findLowStockByTenant(input.tenantId, input.branchId),
      this.entries.consumptionByPart(input.tenantId, from, to, input.branchId),
    ]);

    const outByPart = new Map(consumption.map((c) => [c.partId, c.totalOut]));

    const items = lowStock.map((item) => {
      const totalOut = outByPart.get(item.partId) ?? 0;
      const dailyConsumption = Math.round((totalOut / daysLookback) * 100) / 100;
      const daysRemaining =
        dailyConsumption > 0 ? Math.floor(item.stockDisponible / dailyConsumption) : null;
      const suggestedReorderQty = Math.max(
        Math.ceil(dailyConsumption * daysLookback) - item.stockDisponible,
        Math.ceil(item.minStockAlert - item.stockDisponible),
        1,
      );
      return {
        partId: item.partId,
        sku: item.sku,
        name: item.name,
        branchId: item.branchId,
        stockDisponible: item.stockDisponible,
        minStockAlert: item.minStockAlert,
        dailyConsumption,
        daysRemaining,
        suggestedReorderQty,
      };
    });

    return { tenantId: input.tenantId, daysLookback, criticalCount: items.length, items };
  }
}

export interface CreatePurchaseOrderDraftInput {
  tenantId: string;
  items: PurchaseOrderDraftItem[];
  notes?: string;
  createdBy: string;
}

@Injectable()
export class CreatePurchaseOrderDraftUseCase {
  constructor(
    @Inject(PURCHASE_ORDER_DRAFT_REPOSITORY)
    private readonly drafts: PurchaseOrderDraftRepository,
  ) {}

  async execute(input: CreatePurchaseOrderDraftInput) {
    const id = randomUUID();
    await this.drafts.create({
      id,
      tenantId: input.tenantId,
      status: 'DRAFT',
      items: input.items,
      notes: input.notes ?? null,
      createdBy: input.createdBy,
      approvedBy: null,
      approvedAt: null,
      createdAt: new Date(),
    });
    return { id, status: 'DRAFT' };
  }
}

export interface StockAlertInput {
  tenantId: string;
  partId: string;
  partName: string;
  currentStock: number;
  minStock: number;
}

@Injectable()
export class CreateStockAlertUseCase {
  constructor(
    @Inject(NOTIFICATION_PORT) private readonly notifications: NotificationPort,
    @Inject(NOTIFICATION_REPOSITORY) private readonly notificationRepo: NotificationRepository,
  ) {}

  async execute(input: StockAlertInput) {
    const adminIds = await this.notificationRepo.findAdminUserIds(input.tenantId);
    await Promise.all(
      adminIds.map((userId) =>
        this.notifications.notifyUser(userId, {
          type: 'STOCK_ALERT',
          title: `Stock bajo: ${input.partName}`,
          body: `${input.partName} tiene ${input.currentStock} unidades (mínimo ${input.minStock}). Considera reabastecer.`,
          resourceType: 'part',
          resourceId: input.partId,
        }),
      ),
    );
    return { notified: adminIds.length };
  }
}

@Injectable()
export class GetPendingWorkOrdersUseCase {
  constructor(@Inject(WORK_ORDER_REPOSITORY) private readonly workOrders: WorkOrderRepository) {}

  async execute(tenantId: string, branchId?: string) {
    const now = new Date();
    const orders = await this.workOrders.findPendingByTenant(tenantId, branchId);
    return orders.map((wo) => ({
      id: wo.id,
      orderNumber: wo.orderNumber,
      status: wo.status,
      customerId: wo.customerId,
      vehicleId: wo.vehicleId,
      promisedDeliveryAt: wo.promisedDeliveryAt,
      overdue: wo.promisedDeliveryAt < now,
    }));
  }
}

export interface RecordReportInput {
  tenantId: string;
  type: string;
  periodStart: Date;
  periodEnd: Date;
  pdfR2Key: string;
}

@Injectable()
export class RecordReportUseCase {
  constructor(@Inject(REPORT_REPOSITORY) private readonly reports: ReportRepository) {}

  async execute(input: RecordReportInput) {
    const id = randomUUID();
    await this.reports.create({
      id,
      tenantId: input.tenantId,
      type: input.type,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      pdfR2Key: input.pdfR2Key,
      status: 'READY',
      generatedAt: new Date(),
      createdAt: new Date(),
    });
    return { id, status: 'READY' };
  }
}

export interface GenerateReportInput {
  tenantId: string;
  type: string;
  periodStart: Date;
  periodEnd: Date;
}

@Injectable()
export class GenerateReportUseCase {
  constructor(@Inject(REPORT_REPOSITORY) private readonly reports: ReportRepository) {}

  async execute(input: GenerateReportInput) {
    const id = randomUUID();
    const report: ReportRecord = {
      id,
      tenantId: input.tenantId,
      type: input.type,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      pdfR2Key: null,
      status: 'PENDING',
      generatedAt: null,
      createdAt: new Date(),
    };
    await this.reports.create(report);
    return { id, status: 'PENDING' };
  }
}

@Injectable()
export class SendOwnerWhatsAppUseCase {
  constructor(@Inject(MESSAGING_PORT) private readonly messaging: MessagingPort) {}

  async execute(tenantId: string, content: string) {
    const sent = await this.messaging.sendOwnerMessage(tenantId, content);
    return { sent };
  }
}

@Injectable()
export class ListReportsUseCase {
  constructor(@Inject(REPORT_REPOSITORY) private readonly reports: ReportRepository) {}

  async execute(tenantId: string, pagination: Pagination) {
    return this.reports.listByTenant(tenantId, pagination);
  }
}

@Injectable()
export class GetReportDownloadUrlUseCase {
  constructor(
    @Inject(REPORT_REPOSITORY) private readonly reports: ReportRepository,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  /** Returns null if the report doesn't exist; throws-free contract so the
   *  controller maps not-found / not-ready to the right HTTP status. */
  async execute(reportId: string, tenantId: string) {
    const report = await this.reports.findById(reportId, tenantId);
    if (!report) return { status: 'NOT_FOUND' as const };
    if (report.status !== 'READY' || !report.pdfR2Key) {
      return { status: 'NOT_READY' as const, reportStatus: report.status };
    }
    const url = await this.storage.getSignedUrl(report.pdfR2Key, REPORT_URL_TTL_SECONDS);
    return { status: 'OK' as const, url, expiresInSeconds: REPORT_URL_TTL_SECONDS };
  }
}
