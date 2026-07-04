import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateTenantConfigDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsObject()
  businessHours?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  whatsappPhone?: string;
}
