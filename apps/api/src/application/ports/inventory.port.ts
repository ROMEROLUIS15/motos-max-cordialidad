export interface InventoryPort {
  reserveStock(partId: string, branchId: string, quantity: number, tenantId: string): Promise<void>;
  releaseReservation(partId: string, branchId: string, quantity: number, tenantId: string): Promise<void>;
  releaseAllReservations(workOrderId: string, tenantId: string): Promise<void>;
  confirmStockDiscount(workOrderId: string, tenantId: string): Promise<void>;
}

export const INVENTORY_PORT = Symbol('InventoryPort');
