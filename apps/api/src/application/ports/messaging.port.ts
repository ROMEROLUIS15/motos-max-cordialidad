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
}

export const MESSAGING_PORT = Symbol('MessagingPort');
