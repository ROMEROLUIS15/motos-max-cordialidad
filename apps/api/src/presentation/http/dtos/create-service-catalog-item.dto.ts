import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateServiceCatalogItemDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  estimatedHours!: number;

  @IsNumber()
  @Min(0)
  suggestedPrice!: number;

  @IsString()
  serviceType!: string;
}
