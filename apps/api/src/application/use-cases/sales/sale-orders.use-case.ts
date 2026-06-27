import {
  Inject,
  Injectable,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SaleOrder, SalePaymentMethod } from '../../../domain/entities/sale-order.entity';
import {
  SaleOrderRepository,
  SALE_ORDER_REPOSITORY,
  SaleOrderSearchFilters,
  SaleOrderListItem,
} from '../../../domain/repositories/sale-order.repository';
import {
  MotorcycleUnitRepository,
  MOTORCYCLE_UNIT_REPOSITORY,
} from '../../../domain/repositories/motorcycle-unit.repository';
import {
  CustomerRepository,
  CUSTOMER_REPOSITORY,
} from '../../../domain/repositories/customer.repository';
import {
  TenantRepository,
  TENANT_REPOSITORY,
} from '../../../domain/repositories/tenant.repository';
import { PdfGeneratorPort, PDF_GENERATOR_PORT } from '../../ports/pdf-generator.port';
import { StoragePort, STORAGE_PORT } from '../../ports/storage.port';
import { Pagination, PaginatedResult } from '../../../domain/shared/pagination';

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
    if (active) {
      throw new ConflictException(
        `La motocicleta ya tiene una venta activa (${active.orderNumber})`,
      );
    }

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
    // Reserve the unit while the sale is in progress.
    domainError(() => unit.changeStatus('RESERVED'));
    await this.unitRepo.save(unit);
    return order;
  }
}

@Injectable()
export class ConfirmSaleOrderUseCase {
  constructor(
    @Inject(SALE_ORDER_REPOSITORY) private readonly orderRepo: SaleOrderRepository,
    @Inject(MOTORCYCLE_UNIT_REPOSITORY) private readonly unitRepo: MotorcycleUnitRepository,
  ) {}

  async execute(orderId: string, tenantId: string): Promise<void> {
    const order = await this.orderRepo.findById(orderId, tenantId);
    if (!order) throw new NotFoundException('Orden de venta no encontrada');
    domainError(() => order.confirm());
    await this.orderRepo.save(order);

    const unit = await this.unitRepo.findById(order.motorcycleUnitId, tenantId);
    if (unit) {
      domainError(() => unit.changeStatus('SOLD'));
      await this.unitRepo.save(unit);
    }
  }
}

@Injectable()
export class CancelSaleOrderUseCase {
  constructor(
    @Inject(SALE_ORDER_REPOSITORY) private readonly orderRepo: SaleOrderRepository,
    @Inject(MOTORCYCLE_UNIT_REPOSITORY) private readonly unitRepo: MotorcycleUnitRepository,
  ) {}

  async execute(orderId: string, tenantId: string): Promise<void> {
    const order = await this.orderRepo.findById(orderId, tenantId);
    if (!order) throw new NotFoundException('Orden de venta no encontrada');
    domainError(() => order.cancel());
    await this.orderRepo.save(order);

    // Return the motorcycle to the sellable pool (reverses RESERVED or SOLD).
    const unit = await this.unitRepo.findById(order.motorcycleUnitId, tenantId);
    if (unit) {
      unit.releaseToInventory();
      await this.unitRepo.save(unit);
    }
  }
}

export interface SearchSaleOrdersInput extends SaleOrderSearchFilters {
  tenantId: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class SearchSaleOrdersUseCase {
  constructor(@Inject(SALE_ORDER_REPOSITORY) private readonly orderRepo: SaleOrderRepository) {}

  async execute(input: SearchSaleOrdersInput): Promise<PaginatedResult<SaleOrderListItem>> {
    const pagination: Pagination = { page: input.page ?? 1, pageSize: input.pageSize ?? 20 };
    return this.orderRepo.search(
      { status: input.status, customerId: input.customerId },
      input.tenantId,
      pagination,
    );
  }
}

@Injectable()
export class GetSaleOrderDetailUseCase {
  constructor(@Inject(SALE_ORDER_REPOSITORY) private readonly orderRepo: SaleOrderRepository) {}

  async execute(orderId: string, tenantId: string): Promise<SaleOrder> {
    const order = await this.orderRepo.findById(orderId, tenantId);
    if (!order) throw new NotFoundException('Orden de venta no encontrada');
    return order;
  }
}

@Injectable()
export class GetSaleContractUrlUseCase {
  private readonly URL_TTL = 3600; // 1h

  constructor(
    @Inject(SALE_ORDER_REPOSITORY) private readonly orderRepo: SaleOrderRepository,
    @Inject(MOTORCYCLE_UNIT_REPOSITORY) private readonly unitRepo: MotorcycleUnitRepository,
    @Inject(CUSTOMER_REPOSITORY) private readonly customerRepo: CustomerRepository,
    @Inject(TENANT_REPOSITORY) private readonly tenantRepo: TenantRepository,
    @Inject(PDF_GENERATOR_PORT) private readonly pdf: PdfGeneratorPort,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  async execute(
    orderId: string,
    tenantId: string,
  ): Promise<{ url: string; expiresInSeconds: number }> {
    const order = await this.orderRepo.findById(orderId, tenantId);
    if (!order) throw new NotFoundException('Orden de venta no encontrada');
    if (order.status !== 'CONFIRMED') {
      throw new UnprocessableEntityException(
        'El contrato solo está disponible para una venta confirmada',
      );
    }

    if (!order.contractR2Key) {
      const [tenant, customer, unit] = await Promise.all([
        this.tenantRepo.findById(tenantId),
        this.customerRepo.findById(order.customerId, tenantId),
        this.unitRepo.findById(order.motorcycleUnitId, tenantId),
      ]);
      if (!tenant || !customer || !unit) {
        throw new NotFoundException('No se pudo ensamblar el contrato (datos faltantes)');
      }

      const buffer = await this.pdf.generateSaleContractPdf({
        orderNumber: order.orderNumber,
        issuedAt: new Date(),
        tenant: {
          name: tenant.name,
          taxId: tenant.taxId,
          address: tenant.address,
          phone: tenant.phone,
        },
        customer: {
          fullName: customer.fullName,
          documentType: customer.documentType,
          documentNumber: customer.documentNumber,
          phone: customer.phone,
          address: customer.address,
          city: customer.city,
        },
        motorcycle: {
          brand: unit.brand,
          model: unit.model,
          year: unit.year,
          vin: unit.vin,
          engineNumber: unit.engineNumber,
          plate: unit.plate,
          color: unit.color,
          condition: unit.condition,
          mileage: unit.mileage,
        },
        salePrice: order.salePrice,
        discount: order.discount,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        downPayment: order.downPayment,
        financingMonths: order.financingMonths,
      });

      const key = `${tenantId}/sale-contracts/${order.id}/${order.orderNumber}.pdf`;
      await this.storage.upload(key, buffer, 'application/pdf');
      order.attachContract(key);
      await this.orderRepo.save(order);
    }

    const url = await this.storage.getSignedUrl(order.contractR2Key!, this.URL_TTL);
    return { url, expiresInSeconds: this.URL_TTL };
  }
}
