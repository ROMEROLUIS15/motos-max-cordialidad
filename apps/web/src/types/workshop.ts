export const WORK_ORDER_STATUSES = [
  'PENDING',
  'IN_PROGRESS',
  'WAITING_PARTS',
  'COMPLETED',
  'DELIVERED',
  'CANCELLED',
] as const;
export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

export const VALID_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  PENDING: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['WAITING_PARTS', 'COMPLETED', 'CANCELLED'],
  WAITING_PARTS: ['IN_PROGRESS', 'CANCELLED'],
  COMPLETED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

export const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En proceso',
  WAITING_PARTS: 'Esperando repuestos',
  COMPLETED: 'Completada',
  DELIVERED: 'Entregada',
  CANCELLED: 'Cancelada',
};

export const STATUS_BADGE: Record<WorkOrderStatus, string> = {
  PENDING: 'bg-gray-100 text-gray-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  WAITING_PARTS: 'bg-amber-100 text-amber-800',
  COMPLETED: 'bg-indigo-100 text-indigo-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-700',
};

export const FUEL_LEVELS = ['EMPTY', 'QUARTER', 'HALF', 'THREE_QUARTERS', 'FULL'] as const;
export type FuelLevel = (typeof FUEL_LEVELS)[number];
export const FUEL_LABELS: Record<FuelLevel, string> = {
  EMPTY: 'Vacío',
  QUARTER: '1/4',
  HALF: '1/2',
  THREE_QUARTERS: '3/4',
  FULL: 'Lleno',
};

export const PHOTO_PHASES = ['INGRESO', 'PROCESO', 'ENTREGA'] as const;
export type PhotoPhase = (typeof PHOTO_PHASES)[number];

export interface WorkOrder {
  id: string;
  orderNumber: string;
  branchId: string;
  vehicleId: string;
  customerId: string;
  technicianId: string;
  serviceType: string;
  problemDescription: string;
  status: WorkOrderStatus;
  promisedDeliveryAt: string;
  finalOdometer: number | null;
  observations: string | null;
  createdAt: string;
}

/** Fila del listado de órdenes: incluye el resumen de cliente y moto para mostrar/buscar. */
export interface WorkOrderListItem {
  id: string;
  orderNumber: string;
  branchId: string;
  vehicleId: string;
  customerId: string;
  technicianId: string;
  serviceType: string;
  status: WorkOrderStatus;
  promisedDeliveryAt: string;
  createdAt: string;
  customerName: string;
  vehiclePlate: string;
  vehicleBrand: string;
  vehicleModel: string;
}

export interface WorkOrderLine {
  id: string;
  workOrderId: string;
  description: string;
  estimatedHours: number | null;
  unitPrice: number;
  technicianId: string | null;
  serviceCatalogId: string | null;
}

export interface WorkOrderPart {
  id: string;
  workOrderId: string;
  partId: string;
  partName: string;
  partSku: string;
  quantity: number;
  unitPriceAtSale: number;
}

export interface StatusHistoryEntry {
  workOrderId: string;
  previousStatus: WorkOrderStatus | null;
  newStatus: WorkOrderStatus;
  changedBy: string;
  note: string | null;
  changedAt: string;
}

export interface WorkOrderDetail {
  workOrder: WorkOrder;
  lines: WorkOrderLine[];
  parts: WorkOrderPart[];
  statusHistory: StatusHistoryEntry[];
  total: number;
}

export interface PhotoEvidence {
  id: string;
  phase: PhotoPhase;
  description: string | null;
  filename: string;
  url: string;
  createdAt: string;
}
