import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class RegisterPaymentDto {
  @IsString()
  workOrderId!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  paymentMethod!: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
