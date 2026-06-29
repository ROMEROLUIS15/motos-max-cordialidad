import type { WorkOrderStatus } from '@/types/workshop';
import type { QuoteStatus } from '@/types/commerce';

export type Run = (fn: () => Promise<unknown>) => Promise<void>;

export const money = (n: number) =>
  n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

export const QUOTE_VARIANT: Record<
  QuoteStatus,
  'secondary' | 'default' | 'success' | 'destructive' | 'warning'
> = {
  DRAFT: 'secondary',
  SENT: 'default',
  APPROVED: 'success',
  REJECTED: 'destructive',
  EXPIRED: 'warning',
};

export interface VehicleServiceHistory {
  workOrders: Array<{
    id: string;
    orderNumber: string;
    status: WorkOrderStatus;
    createdAt: string;
    serviceType: string;
    parts: Array<{ quantity: number; part: { name: string } }>;
    photoEvidences: Array<{ id: string }>;
  }>;
}
