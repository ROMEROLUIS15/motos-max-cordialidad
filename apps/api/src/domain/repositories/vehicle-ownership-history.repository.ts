export interface VehicleOwnershipHistoryRecord {
  id: string;
  vehicleId: string;
  previousOwner: string;
  newOwner: string;
  transferredAt: Date;
  transferredBy: string;
}

export interface VehicleOwnershipHistoryRepository {
  create(entry: Omit<VehicleOwnershipHistoryRecord, 'id'>): Promise<void>;
  findByVehicle(vehicleId: string): Promise<VehicleOwnershipHistoryRecord[]>;
}

export const VEHICLE_OWNERSHIP_HISTORY_REPOSITORY = Symbol('VehicleOwnershipHistoryRepository');
