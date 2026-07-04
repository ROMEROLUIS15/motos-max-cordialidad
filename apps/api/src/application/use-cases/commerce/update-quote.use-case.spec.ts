import { UpdateQuoteUseCase } from './update-quote.use-case';
import { Quote } from '../../../domain/entities/quote.entity';
import { QuoteStatus } from '../../../domain/value-objects/quote-status.vo';

function makeQuote(
  status: QuoteStatus = QuoteStatus.DRAFT,
  pdfR2Key: string | null = 'tenant-1/quotes/q1/COT-1.pdf',
): Quote {
  const now = new Date();
  return new Quote(
    'quote-1',
    'tenant-1',
    'wo-1',
    'COT-2026-000001',
    status,
    100_000,
    19,
    19_000,
    119_000,
    new Date(now.getTime() + 86400000),
    pdfR2Key,
    'T&C',
    1,
    now,
    now,
  );
}

function make() {
  const quoteRepo = {
    findById: jest.fn().mockResolvedValue(makeQuote()),
    saveVersion: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const pdfGenerator = { generateQuotePdf: jest.fn().mockResolvedValue(Buffer.from('pdf')) };
  const storage = { upload: jest.fn().mockResolvedValue(undefined) };
  const assembler = {
    assemble: jest.fn().mockResolvedValue({
      pdfData: {},
      subtotal: 150_000,
      vatPercentage: 19,
      vatAmount: 28_500,
      total: 178_500,
    }),
  };
  const useCase = new UpdateQuoteUseCase(
    quoteRepo as never,
    pdfGenerator as never,
    storage as never,
    assembler as never,
  );
  return { useCase, quoteRepo, pdfGenerator, storage, assembler };
}

describe('UpdateQuoteUseCase', () => {
  it('throws NotFoundException when the quote does not exist for the tenant', async () => {
    const { useCase, quoteRepo } = make();
    quoteRepo.findById.mockResolvedValue(null);
    await expect(
      useCase.execute({ tenantId: 'tenant-1', quoteId: 'quote-1' }),
    ).rejects.toMatchObject({
      status: 404,
    });
  });

  it.each([QuoteStatus.APPROVED, QuoteStatus.REJECTED, QuoteStatus.EXPIRED])(
    'rejects updating a quote in %s status',
    async (status) => {
      const { useCase, quoteRepo } = make();
      quoteRepo.findById.mockResolvedValue(makeQuote(status));
      await expect(
        useCase.execute({ tenantId: 'tenant-1', quoteId: 'quote-1' }),
      ).rejects.toMatchObject({
        status: 422,
      });
      expect(quoteRepo.save).not.toHaveBeenCalled();
    },
  );

  it('snapshots the current version before recalculating, when a previous PDF exists', async () => {
    const { useCase, quoteRepo } = make();
    await useCase.execute({ tenantId: 'tenant-1', quoteId: 'quote-1' });

    expect(quoteRepo.saveVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        quoteId: 'quote-1',
        version: 1,
        pdfR2Key: 'tenant-1/quotes/q1/COT-1.pdf',
      }),
    );
  });

  it('skips the version snapshot when there is no prior PDF', async () => {
    const { useCase, quoteRepo } = make();
    quoteRepo.findById.mockResolvedValue(makeQuote(QuoteStatus.DRAFT, null));
    await useCase.execute({ tenantId: 'tenant-1', quoteId: 'quote-1' });
    expect(quoteRepo.saveVersion).not.toHaveBeenCalled();
  });

  it('recalculates totals, bumps the version, uploads a new PDF and persists the quote', async () => {
    const { useCase, quoteRepo, storage } = make();
    const quote = await useCase.execute({ tenantId: 'tenant-1', quoteId: 'quote-1' });

    expect(quote.subtotal).toBe(150_000);
    expect(quote.total).toBe(178_500);
    expect(quote.version).toBe(2);
    expect(storage.upload).toHaveBeenCalledWith(
      expect.stringContaining('-v2.pdf'),
      expect.any(Buffer),
      'application/pdf',
    );
    expect(quoteRepo.save).toHaveBeenCalledWith(quote);
  });
});
