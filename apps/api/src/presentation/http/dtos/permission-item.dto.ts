import { IsString } from 'class-validator';

export class PermissionItemDto {
  @IsString()
  module!: string;

  @IsString()
  action!: string;
}
