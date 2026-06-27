export type SaleOrderStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
export type SalePaymentMethod = 'CASH' | 'FINANCED';

const ALLOWED_TRANSITIONS: Record<SaleOrderStatus, SaleOrderStatus[]> = {
  DRAFT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['CANCELLED'],
  CANCELLED: [],
};

/**
 * A motorcycle sale to a customer. Lifecycle: DRAFT → CONFIRMED → CANCELLED.
 * Creating a draft reserves the unit; confirming sells it; cancelling releases
 * it back to AVAILABLE (orchestrated by the use case, which owns the unit).
 * The price is frozen at creation time (independent of later unit price edits).
 */
export class SaleOrder {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly branchId: string,
    public readonly customerId: string,
    public readonly motorcycleUnitId: string,
    public readonly orderNumber: string,
    public salePrice: number,
    public discount: number,
    public totalAmount: number,
    public paymentMethod: SalePaymentMethod,
    public downPayment: number,
    public financingMonths: number | null,
    public status: SaleOrderStatus,
    public notes: string | null,
    public readonly createdBy: string,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {
    if (salePrice <= 0) throw new Error('salePrice must be greater than zero');
    if (discount < 0) throw new Error('discount cannot be negative');
    if (discount > salePrice) throw new Error('discount cannot exceed salePrice');
    if (Math.round((salePrice - discount) * 100) !== Math.round(totalAmount * 100)) {
      throw new Error('totalAmount must equal salePrice minus discount');
    }
    if (downPayment < 0) throw new Error('downPayment cannot be negative');
    if (downPayment > totalAmount) throw new Error('downPayment cannot exceed totalAmount');
    if (paymentMethod === 'FINANCED') {
      if (!financingMonths || financingMonths <= 0) {
        throw new Error('a FINANCED sale requires financingMonths > 0');
      }
    } else if (financingMonths) {
      throw new Error('financingMonths only applies to a FINANCED sale');
    }
  }

  /** Computes total = salePrice - discount; use at construction time. */
  static computeTotal(salePrice: number, discount: number): number {
    return Math.round((salePrice - discount) * 100) / 100;
  }

  private transition(to: SaleOrderStatus): void {
    if (to === this.status) return;
    if (!ALLOWED_TRANSITIONS[this.status].includes(to)) {
      throw new Error(`invalid sale order transition: ${this.status} → ${to}`);
    }
    this.status = to;
    this.updatedAt = new Date();
  }

  confirm(): void {
    this.transition('CONFIRMED');
  }

  cancel(): void {
    this.transition('CANCELLED');
  }
}
