import { Quote, QuoteInvalidTransitionException } from './quote.entity';
import { QuoteStatus } from '../value-objects/quote-status.vo';
import { Payment } from './payment.entity';
import { PaymentMethod } from '../value-objects/payment-method.vo';

function makeQuote(status: QuoteStatus): Quote {
  const now = new Date();
  return new Quote(
    'q1', 't1', 'wo1', 'Q-2026-000001', status, 1000, 19, 190, 1190,
    new Date(now.getTime() + 86400000), 'key.pdf', null, 1, now, now,
  );
}

describe('Quote state machine', () => {
  it('DRAFT → SENT via markAsSent', () => {
    const q = makeQuote(QuoteStatus.DRAFT);
    q.markAsSent();
    expect(q.status).toBe(QuoteStatus.SENT);
  });

  it('SENT → APPROVED via approve', () => {
    const q = makeQuote(QuoteStatus.SENT);
    q.approve();
    expect(q.status).toBe(QuoteStatus.APPROVED);
  });

  it('SENT → REJECTED via reject', () => {
    const q = makeQuote(QuoteStatus.SENT);
    q.reject();
    expect(q.status).toBe(QuoteStatus.REJECTED);
  });

  it('throws when approving a DRAFT (must be SENT first)', () => {
    const q = makeQuote(QuoteStatus.DRAFT);
    expect(() => q.approve()).toThrow(QuoteInvalidTransitionException);
  });

  it('APPROVED and REJECTED are terminal', () => {
    for (const terminal of [QuoteStatus.APPROVED, QuoteStatus.REJECTED, QuoteStatus.EXPIRED]) {
      expect(() => makeQuote(terminal).markAsSent()).toThrow();
    }
  });

  it('recalculate updates vat and total', () => {
    const q = makeQuote(QuoteStatus.DRAFT);
    q.recalculate(2000, 19);
    expect(q.vatAmount).toBeCloseTo(380, 2);
    expect(q.total).toBeCloseTo(2380, 2);
  });

  it('bumpVersion increments version and sets new pdf key', () => {
    const q = makeQuote(QuoteStatus.DRAFT);
    q.bumpVersion('new.pdf');
    expect(q.version).toBe(2);
    expect(q.pdfR2Key).toBe('new.pdf');
  });
});

describe('Payment invariant', () => {
  const base = ['p1', 't1', 'wo1'] as const;
  const tail = [PaymentMethod.CASH, null, null, new Date(), 'u1', new Date()] as const;

  it('rejects amount = 0', () => {
    expect(() => new Payment(...base, 0, ...tail)).toThrow('mayor a cero');
  });

  it('rejects negative amount', () => {
    expect(() => new Payment(...base, -50, ...tail)).toThrow();
  });

  it('accepts positive amount', () => {
    expect(() => new Payment(...base, 100, ...tail)).not.toThrow();
  });
});
