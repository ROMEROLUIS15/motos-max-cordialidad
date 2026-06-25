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
  constructor(vehicleId: string) {
    super(
      `El vehículo ${vehicleId} ya tiene una orden de trabajo activa`,
      'VEHICLE_HAS_ACTIVE_ORDER',
    );
  }
}

export class InsufficientStockException extends DomainException {
  constructor(partId: string, requested: number, available: number) {
    super(
      `Stock insuficiente para el repuesto ${partId}: solicitado ${requested}, disponible ${available}`,
      'INSUFFICIENT_STOCK',
    );
  }
}
