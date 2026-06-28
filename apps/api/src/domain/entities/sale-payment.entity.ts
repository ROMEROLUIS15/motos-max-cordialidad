export type SalePaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'FINANCING' | 'OTHER';

/** A payment recorded against a motorcycle sale order. */
export class SalePayment {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly saleOrderId: string,
    public readonly amount: number,
    public readonly method: SalePaymentMethod,
    public readonly reference: string | null,
    public readonly notes: string | null,
    public readonly paidAt: Date,
    public readonly createdBy: string,
    public readonly createdAt: Date,
  ) {
    if (amount <= 0) throw new Error('El monto del pago debe ser mayor a cero');
  }
}
