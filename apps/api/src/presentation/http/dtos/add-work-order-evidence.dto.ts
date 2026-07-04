import { IsOptional, IsString } from 'class-validator';

export class AddWorkOrderEvidenceDto {
  @IsString()
  phase!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
