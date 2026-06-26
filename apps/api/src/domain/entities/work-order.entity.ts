import {
  WorkOrderStatus,
  isValidTransition,
  TERMINAL_STATUSES,
} from '../value-objects/work-order-status.vo';
import {
  DomainException,
  WorkOrderInvalidTransitionException,
} from '../exceptions/domain.exception';

export interface StatusChange {
  previousStatus: WorkOrderStatus;
  newStatus: WorkOrderStatus;
}

export class WorkOrder {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly branchId: string,
    public readonly orderNumber: string,
    public readonly receptionId: string,
    public readonly vehicleId: string,
    public readonly customerId: string,
    public technicianId: string,
    public serviceType: string,
    public problemDescription: string,
    public status: WorkOrderStatus,
    public readonly promisedDeliveryAt: Date,
    public finalOdometer: number | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
    public deletedAt: Date | null,
    public observations: string | null = null,
  ) {}

  /** Observaciones del servicio (qué encontró/hizo el mecánico). */
  updateObservations(text: string | null): void {
    this.observations = text && text.trim() ? text.trim() : null;
    this.updatedAt = new Date();
  }

  /**
   * Changes status. Throws if the transition is not allowed. Returns the
   * change record so the use case can persist it in statusHistory — no
   * domain events (Fase 1).
   */
  transitionTo(newStatus: WorkOrderStatus): StatusChange {
    if (!isValidTransition(this.status, newStatus)) {
      throw new WorkOrderInvalidTransitionException(this.status, newStatus);
    }
    const previousStatus = this.status;
    this.status = newStatus;
    this.updatedAt = new Date();
    return { previousStatus, newStatus };
  }

  isNearDeadline(hoursThreshold = 2): boolean {
    const threshold = new Date(Date.now() + hoursThreshold * 60 * 60 * 1000);
    return (
      this.promisedDeliveryAt <= threshold &&
      !TERMINAL_STATUSES.includes(this.status) &&
      this.status !== WorkOrderStatus.COMPLETED
    );
  }

  reassignTechnician(technicianId: string): void {
    this.technicianId = technicianId;
    this.updatedAt = new Date();
  }

  setFinalOdometer(reading: number): void {
    this.finalOdometer = reading;
    this.updatedAt = new Date();
  }

  softDelete(): void {
    if (this.status === WorkOrderStatus.DELIVERED) {
      throw new DomainException(
        'No se puede eliminar una orden de trabajo entregada.',
        'WORK_ORDER_DELETE_DELIVERED',
      );
    }
    this.deletedAt = new Date();
    this.updatedAt = new Date();
  }
}
