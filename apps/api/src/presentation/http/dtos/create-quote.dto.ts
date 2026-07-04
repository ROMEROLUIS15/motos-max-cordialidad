import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateQuoteDto {
  @IsString()
  workOrderId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  validDays?: number;
}
