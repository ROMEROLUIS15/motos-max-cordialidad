import { Inject, Injectable } from '@nestjs/common';
import {
  SaleOrderRepository,
  SALE_ORDER_REPOSITORY,
  SalesSummary,
} from '../../../../domain/repositories/sale-order.repository';

export interface GetSalesSummaryInput {
  tenantId: string;
  from?: Date;
  to?: Date;
}

@Injectable()
export class GetSalesSummaryUseCase {
  constructor(@Inject(SALE_ORDER_REPOSITORY) private readonly orderRepo: SaleOrderRepository) {}

  async execute(input: GetSalesSummaryInput): Promise<SalesSummary> {
    const to = input.to ?? new Date();
    const from = input.from ?? new Date(to.getFullYear(), to.getMonth() - 5, 1);
    return this.orderRepo.summary(input.tenantId, from, to);
  }
}
