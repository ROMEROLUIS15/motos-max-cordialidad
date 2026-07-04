import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  name!: string;

  @IsString()
  taxId!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
