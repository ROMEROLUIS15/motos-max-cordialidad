export interface MessagingPort {
  sendWorkOrderCompletedNotification(workOrder: {
    id: string;
    customerId: string;
    vehicleId: string;
    orderNumber: string;
    tenantId: string;
  }): Promise<void>;
  sendWaitingPartsNotification(workOrder: {
    id: string;
    customerId: string;
    vehicleId: string;
    orderNumber: string;
    tenantId: string;
    promisedDeliveryAt: Date;
  }): Promise<void>;
  sendManualMessage(customerId: string, content: string, tenantId: string): Promise<void>;
  /**
   * Proactive message to the workshop OWNER (used by the agents service).
   * Resolves the OWNER's whatsappPhone, falling back to the tenant number.
   * Returns false if no phone could be resolved.
   */
  sendOwnerMessage(tenantId: string, content: string): Promise<boolean>;
}

export const MESSAGING_PORT = Symbol('MessagingPort');
