import { IsString } from 'class-validator';

export class UpdateHomeServiceStatusDto {
  @IsString()
  status!: string;
}
