export interface CustomMotorcycleModel {
  id: string;
  tenantId: string;
  brand: string;
  model: string;
  yearFrom: number;
  yearTo: number | null;
}

export interface CustomMotorcycleModelRepository {
  listByTenant(tenantId: string): Promise<CustomMotorcycleModel[]>;
  create(model: Omit<CustomMotorcycleModel, 'id'>): Promise<CustomMotorcycleModel>;
  delete(id: string, tenantId: string): Promise<void>;
}

export const CUSTOM_MOTORCYCLE_MODEL_REPOSITORY = Symbol('CustomMotorcycleModelRepository');
