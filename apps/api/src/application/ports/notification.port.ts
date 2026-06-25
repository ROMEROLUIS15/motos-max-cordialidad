export interface NotificationPort {
  notifyAdmins(
    tenantId: string,
    payload: { type: string; workOrderId?: string; [key: string]: unknown },
  ): Promise<void>;
  notifyUser(
    userId: string,
    payload: { type: string; title: string; body: string; resourceType?: string; resourceId?: string },
  ): Promise<void>;
}

export const NOTIFICATION_PORT = Symbol('NotificationPort');
