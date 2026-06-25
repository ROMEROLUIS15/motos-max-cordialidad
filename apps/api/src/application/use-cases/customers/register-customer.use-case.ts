import { Inject, Injectable, ConflictException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Customer, DocumentType } from '../../../domain/entities/customer.entity';
import { CustomerRepository, CUSTOMER_REPOSITORY } from '../../../domain/repositories/customer.repository';

export interface RegisterCustomerInput {
  tenantId: string;
  fullName: string;
  documentType: DocumentType;
  documentNumber: string;
  phone: string;
  city: string;
  whatsappPhone?: string;
  email?: string;
  address?: string;
  observations?: string;
}

@Injectable()
export class RegisterCustomerUseCase {
  constructor(@Inject(CUSTOMER_REPOSITORY) private readonly customerRepo: CustomerRepository) {}

  async execute(input: RegisterCustomerInput): Promise<Customer> {
    const existing = await this.customerRepo.findByDocument(input.documentNumber, input.tenantId);
    if (existing) {
      throw new ConflictException(`Customer with document ${input.documentNumber} already exists`);
    }
    const now = new Date();
    const customer = new Customer(
      randomUUID(), input.tenantId, input.fullName, input.documentType,
      input.documentNumber, input.phone, input.whatsappPhone ?? null,
      input.email ?? null, input.address ?? null, input.city,
      null, input.observations ?? null, true, null, null, 0, null, now, now,
    );
    await this.customerRepo.create(customer);
    return customer;
  }
}
