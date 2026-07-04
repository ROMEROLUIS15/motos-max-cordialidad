import { CreateQuoteUseCase } from './create-quote.use-case';
import { WorkOrderStatus } from '../../../domain/value-objects/work-order-status.vo';
import { QuoteStatus } from '../../../domain/value-objects/quote-status.vo';

function makeAssembled(workOrderStatus: WorkOrderStatus) {
  return {
    details: { workOrder: { status: workOrderStatus } },
    pdfData: { termsConditions: 'T&C' },
    subtotal: 100_000,
    vatPercentage: 19,
    vatAmount: 19_000,
    total: 119_000,
  };
}

function make(workOrderStatus: WorkOrderStatus = WorkOrderStatus.PENDING) {
  const quoteRepo = {
    generateQuoteNumber: jest.fn().mockResolvedValue('COT-2026-000001'),
    create: jest.fn().mockResolvedValue(undefined),
  };
  const pdfGenerator = { generateQuotePdf: jest.fn().mockResolvedValue(Buffer.from('pdf')) };
  const storage = { upload: jest.fn().mockResolvedValue(undefined) };
  const assembler = { assemble: jest.fn().mockResolvedValue(makeAssembled(workOrderStatus)) };
  const useCase = new CreateQuoteUseCase(
    quoteRepo as never,
    pdfGenerator as never,
    storage as never,
    assembler as never,
  );
  return { useCase, quoteRepo, pdfGenerator, storage, assembler };
}

describe('CreateQuoteUseCase', () => {
  it.each([WorkOrderStatus.COMPLETED, WorkOrderStatus.DELIVERED, WorkOrderStatus.CANCELLED])(
    'rejects generating a quote for a work order in %s status',
    async (status) => {
      const { useCase, quoteRepo } = make(status);
      await expect(
        useCase.execute({ tenantId: 'tenant-1', workOrderId: 'wo-1' }),
      ).rejects.toMatchObject({
        status: 422,
      });
      expect(quoteRepo.create).not.toHaveBeenCalled();
    },
  );

  it.each([WorkOrderStatus.PENDING, WorkOrderStatus.IN_PROGRESS])(
    'creates a DRAFT quote for a work order in %s status',
    async (status) => {
      const { useCase, quoteRepo, storage } = make(status);
      const quote = await useCase.execute({ tenantId: 'tenant-1', workOrderId: 'wo-1' });

      expect(quote.status).toBe(QuoteStatus.DRAFT);
      expect(quote.subtotal).toBe(100_000);
      expect(quote.total).toBe(119_000);
      expect(quoteRepo.create).toHaveBeenCalledWith(quote);
      expect(storage.upload).toHaveBeenCalledWith(
        expect.stringContaining('tenant-1/quotes/'),
        expect.any(Buffer),
        'application/pdf',
      );
    },
  );

  it('defaults validUntil to 15 days from now', async () => {
    const { useCase } = make();
    const before = Date.now();
    const quote = await useCase.execute({ tenantId: 'tenant-1', workOrderId: 'wo-1' });
    const expectedMs = before + 15 * 86400000;
    expect(Math.abs(quote.validUntil.getTime() - expectedMs)).toBeLessThan(5000);
  });

  it('respects a custom validDays', async () => {
    const { useCase } = make();
    const before = Date.now();
    const quote = await useCase.execute({
      tenantId: 'tenant-1',
      workOrderId: 'wo-1',
      validDays: 30,
    });
    const expectedMs = before + 30 * 86400000;
    expect(Math.abs(quote.validUntil.getTime() - expectedMs)).toBeLessThan(5000);
  });
});
