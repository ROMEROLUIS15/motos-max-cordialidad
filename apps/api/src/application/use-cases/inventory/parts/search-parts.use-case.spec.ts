import { SearchPartsUseCase } from './search-parts.use-case';

describe('SearchPartsUseCase', () => {
  it('defaults to page 1 / pageSize 20 and forwards query, category and branchId', async () => {
    const partRepo = {
      searchWithStock: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
    };
    const useCase = new SearchPartsUseCase(partRepo as never);

    await useCase.execute({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      query: 'bujia',
      category: 'Motor',
    });

    expect(partRepo.searchWithStock).toHaveBeenCalledWith(
      { query: 'bujia', category: 'Motor' },
      'tenant-1',
      'branch-1',
      { page: 1, pageSize: 20 },
    );
  });

  it('respects an explicit page and pageSize', async () => {
    const partRepo = {
      searchWithStock: jest.fn().mockResolvedValue({ items: [], total: 0, page: 2, pageSize: 10 }),
    };
    const useCase = new SearchPartsUseCase(partRepo as never);

    await useCase.execute({ tenantId: 'tenant-1', branchId: 'branch-1', page: 2, pageSize: 10 });

    expect(partRepo.searchWithStock).toHaveBeenCalledWith(
      { query: undefined, category: undefined },
      'tenant-1',
      'branch-1',
      { page: 2, pageSize: 10 },
    );
  });
});
