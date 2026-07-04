import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class StockMovementDto {
  @IsString()
  partId!: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
