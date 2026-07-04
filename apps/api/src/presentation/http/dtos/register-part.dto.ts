import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class RegisterPartDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsString()
  sku!: string;

  @IsString()
  name!: string;

  @IsString()
  category!: string;

  @IsString()
  unit!: string;

  @IsNumber()
  @Min(0)
  costPrice!: number;

  @IsNumber()
  @Min(0)
  salePrice!: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  supplierReference?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minStockAlert?: number;

  @IsOptional()
  @IsString()
  warehouseLocation?: string;
}
