import { VehicleReception, ReceptionPhotoData } from '../entities/vehicle-reception.entity';

export interface VehicleReceptionRepository {
  create(reception: VehicleReception): Promise<void>;
  findById(id: string, tenantId: string): Promise<VehicleReception | null>;
  addPhoto(receptionId: string, photo: ReceptionPhotoData): Promise<void>;
  deletePhoto(receptionId: string, photoId: string): Promise<void>;
  countPhotos(receptionId: string): Promise<number>;
}

export const VEHICLE_RECEPTION_REPOSITORY = Symbol('VehicleReceptionRepository');
