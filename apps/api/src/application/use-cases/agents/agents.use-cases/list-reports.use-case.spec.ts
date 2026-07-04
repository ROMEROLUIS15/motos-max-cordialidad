import { ListReportsUseCase } from './list-reports.use-case';

describe('ListReportsUseCase', () => {
  it('delegates to the repository with the given tenant and pagination', async () => {
    const reports = {
      listByTenant: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
    };
    const useCase = new ListReportsUseCase(reports as never);

    await useCase.execute('tenant-1', { page: 1, pageSize: 20 });

    expect(reports.listByTenant).toHaveBeenCalledWith('tenant-1', { page: 1, pageSize: 20 });
  });
});
