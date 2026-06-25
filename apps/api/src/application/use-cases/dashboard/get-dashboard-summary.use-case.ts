import { Inject, Injectable } from '@nestjs/common';
import { WorkOrderRepository, WORK_ORDER_REPOSITORY } from '../../../domain/repositories/work-order.repository';
import { PaymentRepository, PAYMENT_REPOSITORY } from '../../../domain/repositories/payment.repository';
import { PartStockRepository, PART_STOCK_REPOSITORY } from '../../../domain/repositories/part-stock.repository';
import { StockEntryRepository, STOCK_ENTRY_REPOSITORY } from '../../../domain/repositories/stock-entry.repository';
import { WorkOrderStatus } from '../../../domain/value-objects/work-order-status.vo';

export interface GetDashboardSummaryInput {
  tenantId: string;
  branchId: string;
  from?: Date;
  to?: Date;
}

@Injectable()
export class GetDashboardSummaryUseCase {
  constructor(
    @Inject(WORK_ORDER_REPOSITORY) private readonly workOrderRepo: WorkOrderRepository,
    @Inject(PAYMENT_REPOSITORY) private readonly paymentRepo: PaymentRepository,
    @Inject(PART_STOCK_REPOSITORY) private readonly stockRepo: PartStockRepository,
    @Inject(STOCK_ENTRY_REPOSITORY) private readonly stockEntryRepo: StockEntryRepository,
  ) {}

  async execute(input: GetDashboardSummaryInput) {
    const now = new Date();
    const monthStart = input.from ?? new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = input.to ?? now;
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const { tenantId, branchId } = input;

    const [
      activeByStatus,
      collectedToday,
      collectedMonth,
      avgCycleHours,
      lowStock,
      nearingDeadline,
      technicianRanking,
      incomeTrend,
      topParts,
      waitingPartsCount,
    ] = await Promise.all([
      this.workOrderRepo.countActiveByStatus(branchId, tenantId),
      this.paymentRepo.sumByBranchAndPeriod(branchId, tenantId, dayStart, now),
      this.paymentRepo.sumByBranchAndPeriod(branchId, tenantId, monthStart, monthEnd),
      this.workOrderRepo.avgCycleTimeHours(branchId, tenantId, monthStart, monthEnd),
      this.stockRepo.findLowStock(branchId, tenantId),
      this.workOrderRepo.findNearingDeadline(2, tenantId, branchId),
      this.workOrderRepo.technicianRanking(branchId, tenantId, monthStart, monthEnd, 5),
      this.paymentRepo.incomeTrend(branchId, tenantId, 30),
      this.stockEntryRepo.topPartsByRotation(branchId, tenantId, monthStart, monthEnd, 10),
      this.workOrderRepo.countByStatusInPeriod(WorkOrderStatus.WAITING_PARTS, branchId, tenantId),
    ]);

    return {
      activeByStatus,
      collectedToday,
      collectedMonth,
      avgCycleHours: Math.round(avgCycleHours * 10) / 10,
      lowStock,
      lowStockCount: lowStock.length,
      nearingDeadline: nearingDeadline.map((wo) => ({
        id: wo.id,
        orderNumber: wo.orderNumber,
        status: wo.status,
        promisedDeliveryAt: wo.promisedDeliveryAt,
        overdue: wo.promisedDeliveryAt < now,
      })),
      technicianRanking,
      incomeTrend,
      topParts,
      waitingPartsAlert: waitingPartsCount > 5,
      waitingPartsCount,
    };
  }
}
