import { IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { MotorcycleCondition } from '../../../domain/entities/motorcycle-unit.entity';

export class RegisterMotorcycleUnitDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsString()
  vin!: string;

  @IsString()
  brand!: string;

  @IsString()
  model!: string;

  @IsInt()
  year!: number;

  @IsOptional()
  @IsNumber()
  displacement?: number | null;

  @IsOptional()
  @IsString()
  color?: string | null;

  @IsIn(['NEW', 'USED'])
  condition!: MotorcycleCondition;

  @IsOptional()
  @IsNumber()
  @Min(0)
  mileage?: number;

  @IsOptional()
  @IsString()
  engineNumber?: string | null;

  @IsOptional()
  @IsString()
  plate?: string | null;

  @IsNumber()
  @Min(0)
  costPrice!: number;

  @IsNumber()
  @Min(0)
  salePrice!: number;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  imageUrl?: string | null;
}
