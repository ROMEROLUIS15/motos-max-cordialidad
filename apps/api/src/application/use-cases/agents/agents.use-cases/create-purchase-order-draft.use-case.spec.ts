import { CreatePurchaseOrderDraftUseCase } from './create-purchase-order-draft.use-case';

describe('CreatePurchaseOrderDraftUseCase', () => {
  it('persists a DRAFT purchase order with the given items and returns its id', async () => {
    const drafts = { create: jest.fn().mockResolvedValue(undefined) };
    const useCase = new CreatePurchaseOrderDraftUseCase(drafts as never);

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      items: [{ partId: 'part-1', quantity: 10, reason: 'Stock bajo' }],
      createdBy: 'agent-admin',
    });

    expect(result.status).toBe('DRAFT');
    expect(drafts.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: result.id,
        tenantId: 'tenant-1',
        status: 'DRAFT',
        items: [{ partId: 'part-1', quantity: 10, reason: 'Stock bajo' }],
        approvedBy: null,
        approvedAt: null,
      }),
    );
  });

  it('defaults notes to null when not provided', async () => {
    const drafts = { create: jest.fn().mockResolvedValue(undefined) };
    const useCase = new CreatePurchaseOrderDraftUseCase(drafts as never);

    await useCase.execute({ tenantId: 'tenant-1', items: [], createdBy: 'agent-admin' });

    expect(drafts.create).toHaveBeenCalledWith(expect.objectContaining({ notes: null }));
  });
});
