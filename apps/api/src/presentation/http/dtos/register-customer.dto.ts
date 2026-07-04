import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';
import { DocumentType } from '../../../domain/entities/customer.entity';

export class RegisterCustomerDto {
  @IsString()
  fullName!: string;

  @IsIn(['CC', 'NIT', 'CE', 'PASSPORT'])
  documentType!: DocumentType;

  @IsString()
  documentNumber!: string;

  @IsString()
  phone!: string;

  @IsString()
  city!: string;

  @IsOptional()
  @IsString()
  whatsappPhone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  observations?: string;
}
