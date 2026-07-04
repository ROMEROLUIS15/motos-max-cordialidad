import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdatePartDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  salePrice?: number;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  brand?: string | null;

  @IsOptional()
  @IsString()
  supplierReference?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minStockAlert?: number | null;

  @IsOptional()
  @IsString()
  warehouseLocation?: string | null;
}
