import { PaymentMethod } from '../value-objects/payment-method.vo';
import { DomainException } from '../exceptions/domain.exception';

export class Payment {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly workOrderId: string,
    public readonly amount: number,
    public readonly paymentMethod: PaymentMethod,
    public readonly reference: string | null,
    public readonly notes: string | null,
    public readonly paidAt: Date,
    public readonly createdBy: string,
    public readonly createdAt: Date,
  ) {
    if (amount <= 0) {
      throw new DomainException('El monto del pago debe ser mayor a cero.', 'INVALID_PAYMENT_AMOUNT');
    }
  }
}
