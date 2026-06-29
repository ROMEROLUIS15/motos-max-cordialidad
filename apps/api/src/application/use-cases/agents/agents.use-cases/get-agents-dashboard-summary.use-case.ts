import { Inject, Injectable } from '@nestjs/common';
import {
  PaymentRepository,
  PAYMENT_REPOSITORY,
} from '../../../../domain/repositories/payment.repository';
import {
  WorkOrderRepository,
  WORK_ORDER_REPOSITORY,
} from '../../../../domain/repositories/work-order.repository';

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
