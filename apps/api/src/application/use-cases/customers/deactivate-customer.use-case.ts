import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CustomerRepository, CUSTOMER_REPOSITORY } from '../../../domain/repositories/customer.repository';

@Injectable()
export class DeactivateCustomerUseCase {
  constructor(@Inject(CUSTOMER_REPOSITORY) private readonly customerRepo: CustomerRepository) {}

  async execute(customerId: string, tenantId: string): Promise<void> {
    const customer = await this.customerRepo.findById(customerId, tenantId);
    if (!customer) throw new NotFoundException('Customer not found');
    customer.deactivate();
    await this.customerRepo.save(customer);
  }
}
