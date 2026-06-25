export class Vehicle {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public plate: string,
    public brand: string,
    public model: string,
    public year: number,
    public color: string,
    public engineNumber: string,
    public chassisNumber: string | null,
    public displacement: number | null,
    public fuelType: string | null,
    public currentOdometer: number | null,
    public observations: string | null,
    public currentOwnerId: string,
    public deletedAt: Date | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {
    if (!plate || plate.trim().length === 0) throw new Error('plate cannot be empty');
    const currentYear = new Date().getFullYear();
    if (year < 1950 || year > currentYear + 1) {
      throw new Error(`year must be between 1950 and ${currentYear + 1}`);
    }
  }

  updateOdometer(reading: number): void {
    if (reading < (this.currentOdometer ?? 0)) {
      throw new Error('New odometer reading cannot be less than current reading');
    }
    this.currentOdometer = reading;
    this.updatedAt = new Date();
  }

  transferOwnership(newOwnerId: string): void {
    this.currentOwnerId = newOwnerId;
    this.updatedAt = new Date();
  }

  deactivate(): void {
    this.deletedAt = new Date();
    this.updatedAt = new Date();
  }
}
