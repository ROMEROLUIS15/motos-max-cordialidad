import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateWorkOrderDto {
  @IsString()
  receptionId!: string;

  @IsString()
  technicianId!: string;

  @IsString()
  serviceType!: string;

  @IsString()
  problemDescription!: string;

  @IsDateString()
  promisedDeliveryAt!: string;

  @IsOptional()
  @IsString()
  observations?: string;
}
