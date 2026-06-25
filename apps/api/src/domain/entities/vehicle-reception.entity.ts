import { FuelLevel } from '../value-objects/fuel-level.vo';

export interface ReceptionPhotoData {
  id: string;
  receptionId: string;
  r2Key: string;
  filename: string;
  sizeBytes: number;
  createdAt: Date;
}

export const MAX_RECEPTION_PHOTOS = 10;

export class VehicleReception {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly branchId: string,
    public readonly vehicleId: string,
    public readonly customerId: string,
    public readonly receivedAt: Date,
    public readonly receivedBy: string,
    public odometerReading: number,
    public fuelLevel: FuelLevel,
    public observations: string | null,
    public visibleDamageNotes: string | null,
    public readonly createdAt: Date,
    public photos: ReceptionPhotoData[] = [],
  ) {
    if (odometerReading < 0) {
      throw new Error('La lectura del odómetro no puede ser negativa');
    }
  }

  canAddPhoto(): boolean {
    return this.photos.length < MAX_RECEPTION_PHOTOS;
  }
}
