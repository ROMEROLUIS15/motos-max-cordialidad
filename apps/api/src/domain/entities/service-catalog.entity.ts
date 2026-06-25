export class ServiceCatalogItem {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public name: string,
    public description: string | null,
    public estimatedHours: number,
    public suggestedPrice: number,
    public serviceType: string,
    public isActive: boolean,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  deactivate(): void {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  update(
    data: Partial<
      Pick<ServiceCatalogItem, 'name' | 'description' | 'estimatedHours' | 'suggestedPrice' | 'serviceType'>
    >,
  ): void {
    if (data.name !== undefined) this.name = data.name;
    if (data.description !== undefined) this.description = data.description;
    if (data.estimatedHours !== undefined) this.estimatedHours = data.estimatedHours;
    if (data.suggestedPrice !== undefined) this.suggestedPrice = data.suggestedPrice;
    if (data.serviceType !== undefined) this.serviceType = data.serviceType;
    this.updatedAt = new Date();
  }
}
