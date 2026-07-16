/**
 * Base class for all domain-level exceptions. The presentation layer maps
 * these to HTTP responses (see DomainExceptionFilter). Each carries a stable
 * `code` for clients to switch on.
 */
export class DomainException extends Error {
  constructor(
    message: string,
    public readonly code: string = 'DOMAIN_ERROR',
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class WorkOrderInvalidTransitionException extends DomainException {
  constructor(from: string, to: string) {
    super(
      `Transición de orden de trabajo inválida: ${from} → ${to}`,
      'WORK_ORDER_INVALID_TRANSITION',
    );
  }
}

export class VehicleHasActiveOrderException extends DomainException {
  /** `plate` is shown to the user when available; never expose internal IDs. */
  constructor(plate?: string | null) {
    const who = plate ? `La moto ${plate}` : 'Esta moto';
    super(
      `${who} ya tiene una orden de trabajo activa. Debes completarla o cancelarla antes de crear una nueva.`,
      'VEHICLE_HAS_ACTIVE_ORDER',
    );
  }
}

export class InsufficientStockException extends DomainException {
  /**
   * The message reaches the user, so it never carries internal IDs (same rule as
   * VehicleHasActiveOrderException). Callers always know which part they acted
   * on — the UI names it. `partId` stays readable for logs and Sentry.
   */
  constructor(
    public readonly partId: string,
    public readonly requested: number,
    public readonly available: number,
  ) {
    super(
      `Stock insuficiente para el repuesto: solicitado ${requested}, disponible ${available}`,
      'INSUFFICIENT_STOCK',
    );
  }
}
