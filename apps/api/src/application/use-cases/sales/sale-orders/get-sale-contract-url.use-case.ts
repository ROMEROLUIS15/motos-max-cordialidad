import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
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
import {
  TenantRepository,
  TENANT_REPOSITORY,
} from '../../../../domain/repositories/tenant.repository';
import { PdfGeneratorPort, PDF_GENERATOR_PORT } from '../../../ports/pdf-generator.port';
import { StoragePort, STORAGE_PORT } from '../../../ports/storage.port';

@Injectable()
export class GetSaleContractUrlUseCase {
  private readonly URL_TTL = 3600;

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
    if (order.status !== 'CONFIRMED')
      throw new UnprocessableEntityException(
        'El contrato solo está disponible para una venta confirmada',
      );

    if (!order.contractR2Key) {
      const [tenant, customer, unit] = await Promise.all([
        this.tenantRepo.findById(tenantId),
        this.customerRepo.findById(order.customerId, tenantId),
        this.unitRepo.findById(order.motorcycleUnitId, tenantId),
      ]);
      if (!tenant || !customer || !unit)
        throw new NotFoundException('No se pudo ensamblar el contrato (datos faltantes)');

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
