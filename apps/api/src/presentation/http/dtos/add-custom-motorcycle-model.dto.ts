import { IsInt, IsOptional, IsString } from 'class-validator';

export class AddCustomMotorcycleModelDto {
  @IsString()
  brand!: string;

  @IsString()
  model!: string;

  @IsOptional()
  @IsInt()
  yearFrom?: number;

  @IsOptional()
  @IsInt()
  yearTo?: number | null;
}
