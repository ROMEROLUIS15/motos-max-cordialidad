import {
  SendQuoteUseCase,
  ApproveQuoteUseCase,
  RejectQuoteUseCase,
  GetQuotePdfUrlUseCase,
  ListQuotesUseCase,
  ExpireQuotesUseCase,
} from './quote-lifecycle.use-case';
import { Quote } from '../../../domain/entities/quote.entity';
import { QuoteStatus } from '../../../domain/value-objects/quote-status.vo';
import { WorkOrder } from '../../../domain/entities/work-order.entity';
import { WorkOrderStatus } from '../../../domain/value-objects/work-order-status.vo';

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

function makeWorkOrder(status: WorkOrderStatus): WorkOrder {
  const now = new Date();
  return new WorkOrder(
    'wo-1',
    'tenant-1',
    'branch-1',
    'WO-2026-000001',
    'rec-1',
    'veh-1',
    'cust-1',
    'tech-1',
    'GENERAL',
    'desc',
    status,
    new Date(now.getTime() + 86400000),
    null,
    now,
    now,
    null,
  );
}

describe('SendQuoteUseCase', () => {
  function make() {
    const quoteRepo = {
      findById: jest.fn().mockResolvedValue(makeQuote()),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const workOrderRepo = {
      findById: jest.fn().mockResolvedValue(makeWorkOrder(WorkOrderStatus.PENDING)),
    };
    const storage = { getSignedUrl: jest.fn().mockResolvedValue('https://signed.example/cot.pdf') };
    const messaging = { sendManualMessage: jest.fn().mockResolvedValue(undefined) };
    const useCase = new SendQuoteUseCase(
      quoteRepo as never,
      workOrderRepo as never,
      storage as never,
      messaging as never,
    );
    return { useCase, quoteRepo, workOrderRepo, storage, messaging };
  }

  it('throws NotFoundException when the quote does not exist', async () => {
    const { useCase, quoteRepo } = make();
    quoteRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('quote-1', 'tenant-1')).rejects.toMatchObject({ status: 404 });
  });

  it('marks the quote as SENT and messages the customer with a signed PDF link', async () => {
    const { useCase, quoteRepo, messaging } = make();
    const quote = await useCase.execute('quote-1', 'tenant-1');

    expect(quote.status).toBe(QuoteStatus.SENT);
    expect(quoteRepo.save).toHaveBeenCalledWith(quote);
    expect(messaging.sendManualMessage).toHaveBeenCalledWith(
      'cust-1',
      expect.stringContaining('https://signed.example/cot.pdf'),
      'tenant-1',
    );
  });

  it('does not message the customer when the work order is missing', async () => {
    const { useCase, workOrderRepo, messaging } = make();
    workOrderRepo.findById.mockResolvedValue(null);
    await useCase.execute('quote-1', 'tenant-1');
    expect(messaging.sendManualMessage).not.toHaveBeenCalled();
  });

  it('does not message the customer when the quote has no PDF yet', async () => {
    const { useCase, quoteRepo, messaging } = make();
    quoteRepo.findById.mockResolvedValue(makeQuote(QuoteStatus.DRAFT, null));
    await useCase.execute('quote-1', 'tenant-1');
    expect(messaging.sendManualMessage).not.toHaveBeenCalled();
  });
});

describe('ApproveQuoteUseCase', () => {
  function make(workOrderStatus: WorkOrderStatus = WorkOrderStatus.PENDING) {
    const quoteRepo = {
      findById: jest.fn().mockResolvedValue(makeQuote(QuoteStatus.SENT)),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const workOrderRepo = { findById: jest.fn().mockResolvedValue(makeWorkOrder(workOrderStatus)) };
    const transitionWorkOrder = { execute: jest.fn().mockResolvedValue(undefined) };
    const useCase = new ApproveQuoteUseCase(
      quoteRepo as never,
      workOrderRepo as never,
      transitionWorkOrder as never,
    );
    return { useCase, quoteRepo, workOrderRepo, transitionWorkOrder };
  }

  it('throws NotFoundException when the quote does not exist', async () => {
    const { useCase, quoteRepo } = make();
    quoteRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('quote-1', 'tenant-1', 'user-1')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('approves the quote and auto-transitions a PENDING work order to IN_PROGRESS', async () => {
    const { useCase, quoteRepo, transitionWorkOrder } = make(WorkOrderStatus.PENDING);
    const quote = await useCase.execute('quote-1', 'tenant-1', 'user-1');

    expect(quote.status).toBe(QuoteStatus.APPROVED);
    expect(quoteRepo.save).toHaveBeenCalledWith(quote);
    expect(transitionWorkOrder.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        workOrderId: 'wo-1',
        newStatus: WorkOrderStatus.IN_PROGRESS,
        changedBy: 'user-1',
      }),
    );
  });

  it('does not transition a work order that is already IN_PROGRESS', async () => {
    const { useCase, transitionWorkOrder } = make(WorkOrderStatus.IN_PROGRESS);
    await useCase.execute('quote-1', 'tenant-1', 'user-1');
    expect(transitionWorkOrder.execute).not.toHaveBeenCalled();
  });
});

describe('RejectQuoteUseCase', () => {
  it('throws NotFoundException when the quote does not exist', async () => {
    const quoteRepo = { findById: jest.fn().mockResolvedValue(null), save: jest.fn() };
    const useCase = new RejectQuoteUseCase(quoteRepo as never);
    await expect(useCase.execute('quote-1', 'tenant-1')).rejects.toMatchObject({ status: 404 });
  });

  it('rejects the quote and persists it', async () => {
    const quoteRepo = {
      findById: jest.fn().mockResolvedValue(makeQuote(QuoteStatus.SENT)),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const useCase = new RejectQuoteUseCase(quoteRepo as never);
    const quote = await useCase.execute('quote-1', 'tenant-1');
    expect(quote.status).toBe(QuoteStatus.REJECTED);
    expect(quoteRepo.save).toHaveBeenCalledWith(quote);
  });
});

describe('GetQuotePdfUrlUseCase', () => {
  it('throws NotFoundException when the quote does not exist', async () => {
    const quoteRepo = { findById: jest.fn().mockResolvedValue(null) };
    const storage = { getSignedUrl: jest.fn() };
    const useCase = new GetQuotePdfUrlUseCase(quoteRepo as never, storage as never);
    await expect(useCase.execute('quote-1', 'tenant-1')).rejects.toMatchObject({ status: 404 });
  });

  it('throws NotFoundException when the quote has no PDF yet', async () => {
    const quoteRepo = { findById: jest.fn().mockResolvedValue(makeQuote(QuoteStatus.DRAFT, null)) };
    const storage = { getSignedUrl: jest.fn() };
    const useCase = new GetQuotePdfUrlUseCase(quoteRepo as never, storage as never);
    await expect(useCase.execute('quote-1', 'tenant-1')).rejects.toMatchObject({ status: 404 });
  });

  it('returns a signed url for the stored PDF', async () => {
    const quoteRepo = { findById: jest.fn().mockResolvedValue(makeQuote()) };
    const storage = { getSignedUrl: jest.fn().mockResolvedValue('https://signed.example/cot.pdf') };
    const useCase = new GetQuotePdfUrlUseCase(quoteRepo as never, storage as never);
    await expect(useCase.execute('quote-1', 'tenant-1')).resolves.toEqual({
      url: 'https://signed.example/cot.pdf',
    });
  });
});

describe('ListQuotesUseCase', () => {
  it('delegates to the repository for the given work order and tenant', async () => {
    const quoteRepo = { findByWorkOrder: jest.fn().mockResolvedValue([]) };
    const useCase = new ListQuotesUseCase(quoteRepo as never);
    await useCase.execute('wo-1', 'tenant-1');
    expect(quoteRepo.findByWorkOrder).toHaveBeenCalledWith('wo-1', 'tenant-1');
  });
});

describe('ExpireQuotesUseCase', () => {
  it('expires every quote past its validUntil in a single bulk update and returns how many were expired', async () => {
    const quotes = [makeQuote(QuoteStatus.SENT), makeQuote(QuoteStatus.SENT)];
    const quoteRepo = {
      findExpired: jest.fn().mockResolvedValue(quotes),
      expireMany: jest.fn().mockResolvedValue(undefined),
    };
    const useCase = new ExpireQuotesUseCase(quoteRepo as never);
    const now = new Date();

    const count = await useCase.execute(now);

    expect(count).toBe(2);
    expect(quoteRepo.expireMany).toHaveBeenCalledTimes(1);
    expect(quoteRepo.expireMany).toHaveBeenCalledWith(
      quotes.map((q) => q.id),
      now,
    );
  });

  it('returns 0 and does not call expireMany when there are no expired quotes', async () => {
    const quoteRepo = { findExpired: jest.fn().mockResolvedValue([]), expireMany: jest.fn() };
    const useCase = new ExpireQuotesUseCase(quoteRepo as never);
    const count = await useCase.execute(new Date());
    expect(count).toBe(0);
    expect(quoteRepo.expireMany).not.toHaveBeenCalled();
  });
});
