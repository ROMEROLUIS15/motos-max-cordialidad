import { Inject, Injectable } from '@nestjs/common';
import {
  WorkOrderRepository,
  WORK_ORDER_REPOSITORY,
} from '../../../../domain/repositories/work-order.repository';

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
