export class Part {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public sku: string,
    public name: string,
    public category: string,
    public unit: string,
    public costPrice: number,
    public salePrice: number,
    public description: string | null,
    public brand: string | null,
    public supplierReference: string | null,
    public imageUrl: string | null,
    public minStockAlert: number | null,
    public warehouseLocation: string | null,
    public isActive: boolean,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {
    if (!sku || sku.trim().length === 0) throw new Error('sku cannot be empty');
    if (costPrice < 0) throw new Error('costPrice cannot be negative');
    if (salePrice < costPrice) throw new Error('salePrice cannot be lower than costPrice');
  }

  updatePrices(cost: number, sale: number): void {
    if (cost < 0) throw new Error('costPrice cannot be negative');
    if (sale < cost) throw new Error('salePrice cannot be lower than costPrice');
    this.costPrice = cost;
    this.salePrice = sale;
    this.updatedAt = new Date();
  }

  deactivate(): void {
    this.isActive = false;
    this.updatedAt = new Date();
  }
}
