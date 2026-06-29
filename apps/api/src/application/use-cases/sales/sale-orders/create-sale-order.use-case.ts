import {
  Inject,
  Injectable,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SaleOrder, SalePaymentMethod } from '../../../../domain/entities/sale-order.entity';
import {
  SaleOrderRepository,
  SALE_ORDER_REPOSITORY,
} from '../../../../domain/repositories/sale-order.repository';
import {
  MotorcycleUnitRepository,
  MOTORCYCLE_UNIT_REPOSITORY,
} from '../../../../domain/repositories/motorcycle-unit.repository';
import {
  CustomerRepository,
  CUSTOMER_REPOSITORY,
} from '../../../../domain/repositories/customer.repository';

function domainError<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    throw new UnprocessableEntityException((e as Error).message);
  }
}

export interface CreateSaleOrderInput {
  tenantId: string;
  branchId: string;
  createdBy: string;
  customerId: string;
  motorcycleUnitId: string;
  discount?: number;
  paymentMethod?: SalePaymentMethod;
  downPayment?: number;
  financingMonths?: number | null;
  notes?: string | null;
}

@Injectable()
export class CreateSaleOrderUseCase {
  constructor(
    @Inject(SALE_ORDER_REPOSITORY) private readonly orderRepo: SaleOrderRepository,
    @Inject(MOTORCYCLE_UNIT_REPOSITORY) private readonly unitRepo: MotorcycleUnitRepository,
    @Inject(CUSTOMER_REPOSITORY) private readonly customerRepo: CustomerRepository,
  ) {}

  async execute(input: CreateSaleOrderInput): Promise<SaleOrder> {
    const customer = await this.customerRepo.findById(input.customerId, input.tenantId);
    if (!customer) throw new NotFoundException('Cliente no encontrado');

    const unit = await this.unitRepo.findById(input.motorcycleUnitId, input.tenantId);
    if (!unit) throw new NotFoundException('Motocicleta no encontrada');
    if (unit.status === 'SOLD') throw new ConflictException('La motocicleta ya fue vendida');

    const active = await this.orderRepo.findActiveByUnit(input.motorcycleUnitId, input.tenantId);
    if (active)
      throw new ConflictException(
        `La motocicleta ya tiene una venta activa (${active.orderNumber})`,
      );

    const discount = input.discount ?? 0;
    const total = SaleOrder.computeTotal(unit.salePrice, discount);
    const paymentMethod = input.paymentMethod ?? 'CASH';
    const orderNumber = await this.orderRepo.generateOrderNumber(
      input.tenantId,
      new Date().getFullYear(),
    );
    const now = new Date();
    const order = domainError(
      () =>
        new SaleOrder(
          randomUUID(),
          input.tenantId,
          input.branchId,
          input.customerId,
          input.motorcycleUnitId,
          orderNumber,
          unit.salePrice,
          discount,
          total,
          paymentMethod,
          input.downPayment ?? 0,
          paymentMethod === 'FINANCED' ? (input.financingMonths ?? null) : null,
          'DRAFT',
          input.notes ?? null,
          null,
          input.createdBy,
          now,
          now,
        ),
    );
    await this.orderRepo.create(order);
    domainError(() => unit.changeStatus('RESERVED'));
    await this.unitRepo.save(unit);
    return order;
  }
}
