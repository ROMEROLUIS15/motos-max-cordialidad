import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AdjustStockDto {
  @IsString()
  partId!: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsInt()
  @Min(0)
  newPhysicalCount!: number;

  @IsString()
  notes!: string;
}
