import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CustomerRepository, CUSTOMER_REPOSITORY } from '../../../domain/repositories/customer.repository';

export interface UpdateCustomerInput {
  customerId: string;
  tenantId: string;
  fullName?: string;
  phone?: string;
  whatsappPhone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string;
  observations?: string | null;
}

@Injectable()
export class UpdateCustomerUseCase {
  constructor(@Inject(CUSTOMER_REPOSITORY) private readonly customerRepo: CustomerRepository) {}

  async execute(input: UpdateCustomerInput): Promise<void> {
    const customer = await this.customerRepo.findById(input.customerId, input.tenantId);
    if (!customer) throw new NotFoundException('Customer not found');

    if (input.fullName !== undefined) customer.fullName = input.fullName;
    if (input.phone !== undefined) customer.phone = input.phone;
    if (input.whatsappPhone !== undefined) customer.whatsappPhone = input.whatsappPhone;
    if (input.email !== undefined) customer.email = input.email;
    if (input.address !== undefined) customer.address = input.address;
    if (input.city !== undefined) customer.city = input.city;
    if (input.observations !== undefined) customer.observations = input.observations;
    customer.updatedAt = new Date();

    await this.customerRepo.save(customer);
  }
}
