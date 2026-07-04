import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateWorkOrderLineDto {
  @IsString()
  description!: string;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedHours?: number;

  @IsOptional()
  @IsString()
  technicianId?: string;

  @IsOptional()
  @IsString()
  serviceCatalogId?: string;
}
