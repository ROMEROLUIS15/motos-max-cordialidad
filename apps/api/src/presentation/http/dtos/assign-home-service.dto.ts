import { IsString } from 'class-validator';

export class AssignHomeServiceDto {
  @IsString()
  assignedTo!: string;
}
