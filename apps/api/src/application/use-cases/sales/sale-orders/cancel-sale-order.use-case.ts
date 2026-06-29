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

function domainError<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    throw new UnprocessableEntityException((e as Error).message);
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

    const unit = await this.unitRepo.findById(order.motorcycleUnitId, tenantId);
    if (unit) {
      unit.releaseToInventory();
      await this.unitRepo.save(unit);
    }
  }
}
