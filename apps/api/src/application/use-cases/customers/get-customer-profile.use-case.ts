import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CustomerRepository,
  CUSTOMER_REPOSITORY,
} from '../../../domain/repositories/customer.repository';
import {
  VehicleRepository,
  VEHICLE_REPOSITORY,
} from '../../../domain/repositories/vehicle.repository';
import {
  WorkOrderRepository,
  WORK_ORDER_REPOSITORY,
} from '../../../domain/repositories/work-order.repository';

const RECENT_WORK_ORDERS_LIMIT = 10;

@Injectable()
export class GetCustomerProfileUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY) private readonly customerRepo: CustomerRepository,
    @Inject(VEHICLE_REPOSITORY) private readonly vehicleRepo: VehicleRepository,
    @Inject(WORK_ORDER_REPOSITORY) private readonly workOrderRepo: WorkOrderRepository,
  ) {}

  async execute(customerId: string, tenantId: string) {
    const customer = await this.customerRepo.findById(customerId, tenantId);
    if (!customer) throw new NotFoundException('Customer not found');

    const [vehicles, recentWorkOrders] = await Promise.all([
      this.vehicleRepo.findByCustomer(customerId, tenantId),
      this.workOrderRepo.findRecentByCustomer(customerId, tenantId, RECENT_WORK_ORDERS_LIMIT),
    ]);

    return { customer, vehicles, recentWorkOrders };
  }
}
