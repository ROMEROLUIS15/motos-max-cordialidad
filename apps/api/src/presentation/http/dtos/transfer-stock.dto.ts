import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class TransferStockDto {
  @IsString()
  partId!: string;

  @IsString()
  fromBranchId!: string;

  @IsString()
  toBranchId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
