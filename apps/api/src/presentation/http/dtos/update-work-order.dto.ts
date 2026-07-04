import { IsOptional, IsString } from 'class-validator';

export class UpdateWorkOrderDto {
  @IsOptional()
  @IsString()
  technicianId?: string;

  @IsOptional()
  @IsString()
  serviceType?: string;

  @IsOptional()
  @IsString()
  problemDescription?: string;

  @IsOptional()
  @IsString()
  observations?: string;
}
