export interface PartWithStock {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  salePrice: number;
  costPrice: number;
  minStockAlert: number | null;
  isActive: boolean;
  stockFisico: number;
  stockReservado: number;
  stockDisponible: number;
  lowStock: boolean;
}

export interface ServiceCatalogItem {
  id: string;
  name: string;
  description: string | null;
  estimatedHours: number;
  suggestedPrice: number;
  serviceType: string;
  isActive: boolean;
}

export const MOVEMENT_TYPES = ['entry', 'exit', 'adjust', 'transfer'] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];
export const MOVEMENT_LABELS: Record<MovementType, string> = {
  entry: 'Entrada',
  exit: 'Salida',
  adjust: 'Ajuste',
  transfer: 'Transferencia',
};
