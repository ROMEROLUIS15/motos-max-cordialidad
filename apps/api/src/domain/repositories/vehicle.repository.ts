import { Vehicle } from '../entities/vehicle.entity';

export interface VehicleRepository {
  findById(id: string, tenantId: string): Promise<Vehicle | null>;
  findByPlate(plate: string, tenantId: string): Promise<Vehicle | null>;
  findByCustomer(customerId: string, tenantId: string): Promise<Vehicle[]>;
  hasActiveWorkOrder(vehicleId: string, tenantId: string): Promise<boolean>;
  save(vehicle: Vehicle): Promise<void>;
  create(vehicle: Vehicle): Promise<void>;
}

export const VEHICLE_REPOSITORY = Symbol('VehicleRepository');
