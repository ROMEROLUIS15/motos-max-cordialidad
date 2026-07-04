import {
  ListPurchaseOrderDraftsUseCase,
  DecidePurchaseOrderDraftUseCase,
} from './purchase-orders.use-cases';

describe('ListPurchaseOrderDraftsUseCase', () => {
  it('delegates to the repository with the given tenant and pagination', async () => {
    const repo = {
      list: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
    };
    const useCase = new ListPurchaseOrderDraftsUseCase(repo as never);

    await useCase.execute('tenant-1', { page: 1, pageSize: 20 });

    expect(repo.list).toHaveBeenCalledWith('tenant-1', { page: 1, pageSize: 20 });
  });
});

describe('DecidePurchaseOrderDraftUseCase', () => {
  function make() {
    const repo = { updateStatus: jest.fn().mockResolvedValue({ id: 'po-1', status: 'APPROVED' }) };
    const useCase = new DecidePurchaseOrderDraftUseCase(repo as never);
    return { useCase, repo };
  }

  it('rejects a decision status that is not APPROVED or REJECTED', async () => {
    const { useCase, repo } = make();
    await expect(
      useCase.execute('po-1', 'tenant-1', 'BOGUS' as never, 'user-1'),
    ).rejects.toMatchObject({ code: 'PURCHASE_ORDER_INVALID_DECISION' });
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });

  it('approves a draft by delegating to the repository', async () => {
    const { useCase, repo } = make();
    await useCase.execute('po-1', 'tenant-1', 'APPROVED', 'user-1');
    expect(repo.updateStatus).toHaveBeenCalledWith('po-1', 'tenant-1', 'APPROVED', 'user-1');
  });

  it('rejects a draft by delegating to the repository', async () => {
    const { useCase, repo } = make();
    await useCase.execute('po-1', 'tenant-1', 'REJECTED', 'user-1');
    expect(repo.updateStatus).toHaveBeenCalledWith('po-1', 'tenant-1', 'REJECTED', 'user-1');
  });

  it('returns null when the draft does not exist for the tenant', async () => {
    const { useCase, repo } = make();
    repo.updateStatus.mockResolvedValue(null);
    await expect(useCase.execute('po-1', 'tenant-1', 'APPROVED', 'user-1')).resolves.toBeNull();
  });
});
