export type MotorcycleCondition = 'NEW' | 'USED';
export type MotorcycleStatus = 'AVAILABLE' | 'RESERVED' | 'SOLD';

const ALLOWED_TRANSITIONS: Record<MotorcycleStatus, MotorcycleStatus[]> = {
  AVAILABLE: ['RESERVED', 'SOLD'],
  RESERVED: ['AVAILABLE', 'SOLD'],
  SOLD: [],
};

/**
 * A single motorcycle unit in the sales inventory (new or used). Identified by
 * its VIN within a tenant. Lifecycle: AVAILABLE → RESERVED → SOLD (SOLD is
 * terminal); a reservation can be released back to AVAILABLE.
 */
export class MotorcycleUnit {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public branchId: string,
    public vin: string,
    public brand: string,
    public model: string,
    public year: number,
    public displacement: number | null,
    public color: string | null,
    public condition: MotorcycleCondition,
    public mileage: number,
    public engineNumber: string | null,
    public plate: string | null,
    public costPrice: number,
    public salePrice: number,
    public status: MotorcycleStatus,
    public description: string | null,
    public imageUrl: string | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {
    if (!vin || vin.trim().length === 0) throw new Error('vin cannot be empty');
    if (!brand || brand.trim().length === 0) throw new Error('brand cannot be empty');
    if (!model || model.trim().length === 0) throw new Error('model cannot be empty');
    const currentYear = new Date().getFullYear();
    if (year < 1950 || year > currentYear + 1) throw new Error('year is out of range');
    if (mileage < 0) throw new Error('mileage cannot be negative');
    if (costPrice < 0) throw new Error('costPrice cannot be negative');
    if (salePrice < costPrice) throw new Error('salePrice cannot be lower than costPrice');
    if (condition === 'NEW' && mileage > 0) throw new Error('a NEW unit cannot have mileage');
  }

  updatePrices(cost: number, sale: number): void {
    if (cost < 0) throw new Error('costPrice cannot be negative');
    if (sale < cost) throw new Error('salePrice cannot be lower than costPrice');
    this.costPrice = cost;
    this.salePrice = sale;
    this.updatedAt = new Date();
  }

  changeStatus(next: MotorcycleStatus): void {
    if (next === this.status) return;
    if (!ALLOWED_TRANSITIONS[this.status].includes(next)) {
      throw new Error(`invalid status transition: ${this.status} → ${next}`);
    }
    this.status = next;
    this.updatedAt = new Date();
  }
}
