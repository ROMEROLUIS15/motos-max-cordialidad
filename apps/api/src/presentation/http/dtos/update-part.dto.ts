export interface UpdatePartDto {
  name?: string;
  category?: string;
  unit?: string;
  costPrice?: number;
  salePrice?: number;
  description?: string | null;
  brand?: string | null;
  supplierReference?: string | null;
  minStockAlert?: number | null;
  warehouseLocation?: string | null;
}
