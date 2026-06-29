import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  SaleOrderRepository,
  SALE_ORDER_REPOSITORY,
  SaleOrderDetailView,
} from '../../../../domain/repositories/sale-order.repository';

@Injectable()
export class GetSaleOrderDetailUseCase {
  constructor(@Inject(SALE_ORDER_REPOSITORY) private readonly orderRepo: SaleOrderRepository) {}

  async execute(orderId: string, tenantId: string): Promise<SaleOrderDetailView> {
    const order = await this.orderRepo.findDetailById(orderId, tenantId);
    if (!order) throw new NotFoundException('Orden de venta no encontrada');
    return order;
  }
}
