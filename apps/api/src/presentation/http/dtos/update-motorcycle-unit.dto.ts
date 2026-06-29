import { MotorcycleCondition } from '../../../domain/entities/motorcycle-unit.entity';

export interface UpdateMotorcycleUnitDto {
  branchId?: string;
  brand?: string;
  model?: string;
  year?: number;
  displacement?: number | null;
  color?: string | null;
  condition?: MotorcycleCondition;
  mileage?: number;
  engineNumber?: string | null;
  plate?: string | null;
  costPrice?: number;
  salePrice?: number;
  description?: string | null;
  imageUrl?: string | null;
}
