import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CustomerRepository, CUSTOMER_REPOSITORY } from '../../../domain/repositories/customer.repository';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

@Injectable()
export class GetCustomerProfileUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY) private readonly customerRepo: CustomerRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(customerId: string, tenantId: string) {
    const customer = await this.customerRepo.findById(customerId, tenantId);
    if (!customer) throw new NotFoundException('Customer not found');

    const [vehicles, recentWorkOrders] = await Promise.all([
      this.prisma.vehicle.findMany({
        where: { currentOwnerId: customerId, tenantId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.workOrder.findMany({
        where: { customerId, tenantId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { vehicle: true },
      }),
    ]);

    return { customer, vehicles, recentWorkOrders };
  }
}
