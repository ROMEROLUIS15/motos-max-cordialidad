import { SearchSaleOrdersUseCase } from './search-sale-orders.use-case';
import { PaginatedResult } from '../../../../domain/shared/pagination';
import { SaleOrderListItem } from '../../../../domain/repositories/sale-order.repository';

const emptyResult: PaginatedResult<SaleOrderListItem> = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 20,
};

describe('SearchSaleOrdersUseCase', () => {
  it('defaults to page 1 / pageSize 20 and forwards status + customerId filters', async () => {
    const orderRepo = { search: jest.fn().mockResolvedValue(emptyResult) };
    const useCase = new SearchSaleOrdersUseCase(orderRepo as never);

    await useCase.execute({ tenantId: 'tenant-1', status: 'CONFIRMED', customerId: 'cust-1' });

    expect(orderRepo.search).toHaveBeenCalledWith(
      { status: 'CONFIRMED', customerId: 'cust-1' },
      'tenant-1',
      { page: 1, pageSize: 20 },
    );
  });

  it('respects an explicit page and pageSize', async () => {
    const orderRepo = { search: jest.fn().mockResolvedValue(emptyResult) };
    const useCase = new SearchSaleOrdersUseCase(orderRepo as never);

    await useCase.execute({ tenantId: 'tenant-1', page: 3, pageSize: 50 });

    expect(orderRepo.search).toHaveBeenCalledWith(
      { status: undefined, customerId: undefined },
      'tenant-1',
      { page: 3, pageSize: 50 },
    );
  });
});
