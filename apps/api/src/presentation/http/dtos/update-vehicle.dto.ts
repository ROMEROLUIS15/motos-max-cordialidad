import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateVehicleDto {
  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  engineNumber?: string;

  @IsOptional()
  @IsString()
  chassisNumber?: string | null;

  @IsOptional()
  @IsNumber()
  displacement?: number | null;

  @IsOptional()
  @IsString()
  fuelType?: string | null;

  @IsOptional()
  @IsString()
  observations?: string | null;
}
