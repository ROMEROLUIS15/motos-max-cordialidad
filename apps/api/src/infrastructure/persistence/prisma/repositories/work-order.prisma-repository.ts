import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import {
  WorkOrderRepository,
  WorkOrderFilters,
  StatusHistoryEntry,
  WorkOrderLineRecord,
  WorkOrderPartRecord,
  WorkOrderWithDetails,
} from '../../../../domain/repositories/work-order.repository';
import { WorkOrder } from '../../../../domain/entities/work-order.entity';
import {
  WorkOrderStatus,
  ACTIVE_STATUSES,
} from '../../../../domain/value-objects/work-order-status.vo';
import {
  Pagination,
  PaginatedResult,
  paginationToSkipTake,
} from '../../../../domain/shared/pagination';

type WorkOrderRow = {
  id: string;
  tenantId: string;
  branchId: string;
  orderNumber: string;
  receptionId: string;
  vehicleId: string;
  customerId: string;
  technicianId: string;
  serviceType: string;
  problemDescription: string;
  status: string;
  promisedDeliveryAt: Date;
  finalOdometer: number | null;
  observations: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

@Injectable()
export class WorkOrderPrismaRepository implements WorkOrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(r: WorkOrderRow): WorkOrder {
    return new WorkOrder(
      r.id,
      r.tenantId,
      r.branchId,
      r.orderNumber,
      r.receptionId,
      r.vehicleId,
      r.customerId,
      r.technicianId,
      r.serviceType,
      r.problemDescription,
      r.status as WorkOrderStatus,
      r.promisedDeliveryAt,
      r.finalOdometer,
      r.createdAt,
      r.updatedAt,
      r.deletedAt,
      r.observations,
    );
  }

  async findById(id: string, tenantId: string): Promise<WorkOrder | null> {
    const r = await this.prisma.workOrder.findFirst({ where: { id, tenantId, deletedAt: null } });
    return r ? this.toDomain(r) : null;
  }

  async findByIdWithDetails(id: string, tenantId: string): Promise<WorkOrderWithDetails | null> {
    const r = await this.prisma.workOrder.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        lines: { orderBy: { createdAt: 'asc' } },
        parts: { include: { part: true }, orderBy: { createdAt: 'asc' } },
        statusHistory: { orderBy: { changedAt: 'asc' } },
      },
    });
    if (!r) return null;

    const lines: WorkOrderLineRecord[] = r.lines.map((l) => ({
      id: l.id,
      workOrderId: l.workOrderId,
      description: l.description,
      estimatedHours: l.estimatedHours ? Number(l.estimatedHours) : null,
      unitPrice: Number(l.unitPrice),
      technicianId: l.technicianId,
      serviceCatalogId: l.serviceCatalogId,
    }));
    const parts: WorkOrderPartRecord[] = r.parts.map((p) => ({
      id: p.id,
      workOrderId: p.workOrderId,
      partId: p.partId,
      partName: p.part.name,
      partSku: p.part.sku,
      quantity: Number(p.quantity),
      unitPriceAtSale: Number(p.unitPriceAtSale),
    }));
    const statusHistory: StatusHistoryEntry[] = r.statusHistory.map((h) => ({
      workOrderId: h.workOrderId,
      previousStatus: (h.fromStatus as WorkOrderStatus) ?? null,
      newStatus: h.toStatus as WorkOrderStatus,
      changedBy: h.changedBy,
      note: h.note,
      changedAt: h.changedAt,
    }));

    const linesTotal = lines.reduce((s, l) => s + l.unitPrice, 0);
    const partsTotal = parts.reduce((s, p) => s + p.quantity * p.unitPriceAtSale, 0);

    return {
      workOrder: this.toDomain(r),
      lines,
      parts,
      statusHistory,
      total: linesTotal + partsTotal,
    };
  }

  private buildWhere(
    tenantId: string,
    filters: WorkOrderFilters,
    extra: Prisma.WorkOrderWhereInput,
  ): Prisma.WorkOrderWhereInput {
    const where: Prisma.WorkOrderWhereInput = { tenantId, deletedAt: null, ...extra };
    if (filters.status) where.status = filters.status;
    if (filters.branchId) where.branchId = filters.branchId;
    if (filters.technicianId) where.technicianId = filters.technicianId;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) (where.createdAt as Prisma.DateTimeFilter).gte = filters.from;
      if (filters.to) (where.createdAt as Prisma.DateTimeFilter).lte = filters.to;
    }
    return where;
  }

  private async paginate(
    where: Prisma.WorkOrderWhereInput,
    pagination: Pagination,
  ): Promise<PaginatedResult<WorkOrder>> {
    const { skip, take } = paginationToSkipTake(pagination);
    const [rows, total] = await Promise.all([
      this.prisma.workOrder.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.workOrder.count({ where }),
    ]);
    return {
      items: rows.map((r) => this.toDomain(r)),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
    };
  }

  async findByBranch(
    branchId: string,
    tenantId: string,
    filters: WorkOrderFilters,
    pagination: Pagination,
  ): Promise<PaginatedResult<WorkOrder>> {
    return this.paginate(this.buildWhere(tenantId, filters, { branchId }), pagination);
  }

  async findByTechnician(
    technicianId: string,
    tenantId: string,
    filters: WorkOrderFilters,
    pagination: Pagination,
  ): Promise<PaginatedResult<WorkOrder>> {
    return this.paginate(this.buildWhere(tenantId, filters, { technicianId }), pagination);
  }

  async findNearingDeadline(
    thresholdHours: number,
    tenantId: string,
    branchId?: string,
  ): Promise<WorkOrder[]> {
    const threshold = new Date(Date.now() + thresholdHours * 60 * 60 * 1000);
    const rows = await this.prisma.workOrder.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
        status: { in: ACTIVE_STATUSES as unknown as string[] },
        promisedDeliveryAt: { lte: threshold },
      },
      orderBy: { promisedDeliveryAt: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async countActiveByStatus(branchId: string, tenantId: string): Promise<Record<string, number>> {
    const grouped = await this.prisma.workOrder.groupBy({
      by: ['status'],
      where: {
        tenantId,
        branchId,
        deletedAt: null,
        status: { in: ACTIVE_STATUSES as unknown as string[] },
      },
      _count: { _all: true },
    });
    const result: Record<string, number> = {};
    for (const g of grouped) result[g.status] = g._count._all;
    return result;
  }

  async avgCycleTimeHours(
    branchId: string,
    tenantId: string,
    from: Date,
    to: Date,
  ): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ avg: number | null }>>`
      SELECT AVG(EXTRACT(EPOCH FROM (wo."updatedAt" - wo."createdAt")) / 3600) AS "avg"
      FROM "work_orders" wo
      WHERE wo."tenantId" = ${tenantId} AND wo."branchId" = ${branchId}
        AND wo."status" = 'DELIVERED' AND wo."createdAt" BETWEEN ${from} AND ${to}
    `;
    return rows[0]?.avg ? Number(rows[0].avg) : 0;
  }

  async technicianRanking(
    branchId: string,
    tenantId: string,
    from: Date,
    to: Date,
    limit: number,
  ): Promise<Array<{ technicianId: string; technicianName: string; completed: number }>> {
    const rows = await this.prisma.$queryRaw<
      Array<{ technicianId: string; technicianName: string; completed: bigint }>
    >`
      SELECT wo."technicianId" AS "technicianId", u."fullName" AS "technicianName",
             COUNT(*) AS "completed"
      FROM "work_orders" wo
      JOIN "users" u ON u."id" = wo."technicianId"
      WHERE wo."tenantId" = ${tenantId} AND wo."branchId" = ${branchId}
        AND wo."status" IN ('COMPLETED', 'DELIVERED')
        AND wo."updatedAt" BETWEEN ${from} AND ${to}
      GROUP BY wo."technicianId", u."fullName"
      ORDER BY "completed" DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      technicianId: r.technicianId,
      technicianName: r.technicianName,
      completed: Number(r.completed),
    }));
  }

  async countByStatusInPeriod(
    status: WorkOrderStatus,
    branchId: string,
    tenantId: string,
  ): Promise<number> {
    return this.prisma.workOrder.count({
      where: { tenantId, branchId, deletedAt: null, status },
    });
  }

  async countCompletedInPeriod(
    tenantId: string,
    from: Date,
    to: Date,
    branchId?: string,
  ): Promise<number> {
    return this.prisma.workOrder.count({
      where: {
        tenantId,
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
        status: { in: [WorkOrderStatus.COMPLETED, WorkOrderStatus.DELIVERED] },
        updatedAt: { gte: from, lte: to },
      },
    });
  }

  async findPendingByTenant(tenantId: string, branchId?: string): Promise<WorkOrder[]> {
    const rows = await this.prisma.workOrder.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
        status: { in: ACTIVE_STATUSES as unknown as string[] },
      },
      orderBy: { promisedDeliveryAt: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async create(workOrder: WorkOrder): Promise<void> {
    await this.prisma.workOrder.create({
      data: {
        id: workOrder.id,
        tenantId: workOrder.tenantId,
        branchId: workOrder.branchId,
        orderNumber: workOrder.orderNumber,
        receptionId: workOrder.receptionId,
        vehicleId: workOrder.vehicleId,
        customerId: workOrder.customerId,
        technicianId: workOrder.technicianId,
        serviceType: workOrder.serviceType,
        problemDescription: workOrder.problemDescription,
        status: workOrder.status,
        promisedDeliveryAt: workOrder.promisedDeliveryAt,
        finalOdometer: workOrder.finalOdometer,
        observations: workOrder.observations,
        createdAt: workOrder.createdAt,
        updatedAt: workOrder.updatedAt,
        deletedAt: workOrder.deletedAt,
      },
    });
  }

  async save(workOrder: WorkOrder): Promise<void> {
    await this.prisma.workOrder.update({
      where: { id: workOrder.id },
      data: {
        technicianId: workOrder.technicianId,
        serviceType: workOrder.serviceType,
        problemDescription: workOrder.problemDescription,
        status: workOrder.status,
        finalOdometer: workOrder.finalOdometer,
        observations: workOrder.observations,
        updatedAt: workOrder.updatedAt,
        deletedAt: workOrder.deletedAt,
      },
    });
  }

  async saveStatusHistory(entry: StatusHistoryEntry): Promise<void> {
    await this.prisma.workOrderStatusHistory.create({
      data: {
        workOrderId: entry.workOrderId,
        fromStatus: entry.previousStatus,
        toStatus: entry.newStatus,
        changedBy: entry.changedBy,
        note: entry.note,
        changedAt: entry.changedAt,
      },
    });
  }

  async generateOrderNumber(tenantId: string, year: number): Promise<string> {
    const prefix = `WO-${year}-`;
    const count = await this.prisma.workOrder.count({
      where: { tenantId, orderNumber: { startsWith: prefix } },
    });
    const next = (count + 1).toString().padStart(6, '0');
    return `${prefix}${next}`;
  }

  async addLine(line: WorkOrderLineRecord): Promise<void> {
    await this.prisma.workOrderLine.create({
      data: {
        id: line.id,
        workOrderId: line.workOrderId,
        description: line.description,
        estimatedHours: line.estimatedHours,
        unitPrice: line.unitPrice,
        technicianId: line.technicianId,
        serviceCatalogId: line.serviceCatalogId,
      },
    });
  }

  async updateLine(line: WorkOrderLineRecord): Promise<void> {
    await this.prisma.workOrderLine.update({
      where: { id: line.id },
      data: {
        description: line.description,
        estimatedHours: line.estimatedHours,
        unitPrice: line.unitPrice,
        technicianId: line.technicianId,
        serviceCatalogId: line.serviceCatalogId,
      },
    });
  }

  async removeLine(lineId: string, workOrderId: string): Promise<void> {
    await this.prisma.workOrderLine.deleteMany({ where: { id: lineId, workOrderId } });
  }

  async findLineById(lineId: string, workOrderId: string): Promise<WorkOrderLineRecord | null> {
    const l = await this.prisma.workOrderLine.findFirst({ where: { id: lineId, workOrderId } });
    if (!l) return null;
    return {
      id: l.id,
      workOrderId: l.workOrderId,
      description: l.description,
      estimatedHours: l.estimatedHours ? Number(l.estimatedHours) : null,
      unitPrice: Number(l.unitPrice),
      technicianId: l.technicianId,
      serviceCatalogId: l.serviceCatalogId,
    };
  }

  async addPart(part: WorkOrderPartRecord): Promise<void> {
    await this.prisma.workOrderPart.create({
      data: {
        id: part.id,
        workOrderId: part.workOrderId,
        partId: part.partId,
        quantity: part.quantity,
        unitPriceAtSale: part.unitPriceAtSale,
      },
    });
  }

  async removePart(partId: string, workOrderId: string): Promise<void> {
    await this.prisma.workOrderPart.deleteMany({ where: { id: partId, workOrderId } });
  }

  async findPartById(id: string, workOrderId: string): Promise<WorkOrderPartRecord | null> {
    const p = await this.prisma.workOrderPart.findFirst({
      where: { id, workOrderId },
      include: { part: true },
    });
    if (!p) return null;
    return {
      id: p.id,
      workOrderId: p.workOrderId,
      partId: p.partId,
      partName: p.part.name,
      partSku: p.part.sku,
      quantity: Number(p.quantity),
      unitPriceAtSale: Number(p.unitPriceAtSale),
    };
  }
}
