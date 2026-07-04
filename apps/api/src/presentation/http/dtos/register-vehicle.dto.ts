import { IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

export class RegisterVehicleDto {
  @IsString()
  plate!: string;

  @IsString()
  brand!: string;

  @IsString()
  model!: string;

  @IsOptional()
  @IsInt()
  year?: number | null;

  @IsString()
  color!: string;

  @IsString()
  engineNumber!: string;

  @IsString()
  currentOwnerId!: string;

  @IsOptional()
  @IsString()
  chassisNumber?: string;

  @IsOptional()
  @IsNumber()
  displacement?: number;

  @IsOptional()
  @IsString()
  fuelType?: string;

  @IsOptional()
  @IsInt()
  currentOdometer?: number;

  @IsOptional()
  @IsString()
  observations?: string;
}
