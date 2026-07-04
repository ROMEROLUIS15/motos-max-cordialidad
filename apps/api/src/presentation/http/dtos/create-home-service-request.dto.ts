import { IsOptional, IsString } from 'class-validator';

export class CreateHomeServiceRequestDto {
  @IsString()
  customerName!: string;

  @IsString()
  customerPhone!: string;

  @IsString()
  address!: string;

  @IsString()
  problemDesc!: string;

  @IsString()
  serviceType!: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  branchId?: string;
}
