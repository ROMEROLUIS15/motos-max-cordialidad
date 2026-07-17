import {
  IsEmail,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

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

  /**
   * The settings form always sends this field, so an empty string has to mean
   * "no email" instead of failing the whole request.
   */
  @IsOptional()
  @ValidateIf((o: UpdateTenantConfigDto) => o.email !== '')
  @IsEmail()
  email?: string;

  /** 0 is a valid rate — this workshop does not charge VAT. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  vatPercentage?: number;

  @IsOptional()
  @IsObject()
  businessHours?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  whatsappPhone?: string;
}
