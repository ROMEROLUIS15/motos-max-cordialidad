import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateWorkOrderLineDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedHours?: number | null;

  @IsOptional()
  @IsString()
  technicianId?: string | null;
}
