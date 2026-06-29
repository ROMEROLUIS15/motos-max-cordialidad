export interface UpdateVehicleDto {
  brand?: string;
  model?: string;
  color?: string;
  engineNumber?: string;
  chassisNumber?: string | null;
  displacement?: number | null;
  fuelType?: string | null;
  observations?: string | null;
}
