import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PermissionItemDto } from './permission-item.dto';

export class UpdateRolePermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionItemDto)
  permissions!: PermissionItemDto[];
}
