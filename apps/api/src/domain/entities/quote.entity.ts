import { QuoteStatus, isValidQuoteTransition } from '../value-objects/quote-status.vo';
import { DomainException } from '../exceptions/domain.exception';

export class QuoteInvalidTransitionException extends DomainException {
  constructor(from: QuoteStatus, to: QuoteStatus) {
    super(`Transición de cotización inválida: ${from} → ${to}`, 'QUOTE_INVALID_TRANSITION');
  }
}

export class Quote {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly workOrderId: string,
    public readonly quoteNumber: string,
    public status: QuoteStatus,
    public subtotal: number,
    public vatPercentage: number,
    public vatAmount: number,
    public total: number,
    public validUntil: Date,
    public pdfR2Key: string | null,
    public termsConditions: string | null,
    public version: number,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  private transition(to: QuoteStatus): void {
    if (!isValidQuoteTransition(this.status, to)) {
      throw new QuoteInvalidTransitionException(this.status, to);
    }
    this.status = to;
    this.updatedAt = new Date();
  }

  markAsSent(): void {
    this.transition(QuoteStatus.SENT);
  }

  approve(): void {
    this.transition(QuoteStatus.APPROVED);
  }

  reject(): void {
    this.transition(QuoteStatus.REJECTED);
  }

  expire(): void {
    this.transition(QuoteStatus.EXPIRED);
  }

  /** Records a new version (after content/PDF change). */
  bumpVersion(newPdfR2Key: string): void {
    this.version += 1;
    this.pdfR2Key = newPdfR2Key;
    this.updatedAt = new Date();
  }

  recalculate(subtotal: number, vatPercentage: number): void {
    this.subtotal = subtotal;
    this.vatPercentage = vatPercentage;
    this.vatAmount = Math.round(subtotal * vatPercentage) / 100;
    this.total = subtotal + this.vatAmount;
    this.updatedAt = new Date();
  }
}
