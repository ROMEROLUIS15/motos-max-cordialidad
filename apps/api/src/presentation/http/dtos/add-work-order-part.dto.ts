import { IsInt, IsString, Min } from 'class-validator';

export class AddWorkOrderPartDto {
  @IsString()
  partId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}
