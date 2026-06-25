export class Branch {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public name: string,
    public address: string,
    public phone: string | null,
    public isActive: boolean,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  deactivate(): void {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  activate(): void {
    this.isActive = true;
    this.updatedAt = new Date();
  }
}
