import { Body, Controller, Delete, Get, Inject, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { PermissionGuard } from '../guards/permission.guard';
import { JWTPayload } from '../../../application/ports/jwt.port';
import {
  CreateCustomRoleUseCase,
  UpdateRolePermissionsUseCase,
} from '../../../application/use-cases/identity/create-custom-role.use-case';
import { DeleteRoleUseCase } from '../../../application/use-cases/identity/delete-role.use-case';
import { RoleRepository, ROLE_REPOSITORY } from '../../../domain/repositories/role.repository';
import { CreateRoleDto } from '../dtos/create-role.dto';
import { UpdateRolePermissionsDto } from '../dtos/update-role-permissions.dto';

@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class RolesController {
  constructor(
    private readonly createCustomRoleUseCase: CreateCustomRoleUseCase,
    private readonly updateRolePermissionsUseCase: UpdateRolePermissionsUseCase,
    private readonly deleteRoleUseCase: DeleteRoleUseCase,
    @Inject(ROLE_REPOSITORY) private readonly roleRepo: RoleRepository,
  ) {}

  @Get()
  @RequirePermission('roles:READ')
  async findAll(@CurrentUser() user: JWTPayload) {
    return this.roleRepo.findByTenant(user.tenantId);
  }

  @Post()
  @RequirePermission('roles:CREATE')
  async create(@CurrentUser() user: JWTPayload, @Body() body: CreateRoleDto) {
    return this.createCustomRoleUseCase.execute({
      tenantId: user.tenantId,
      requestingUserId: user.sub,
      name: body.name,
      permissions: body.permissions,
    });
  }

  @Put(':id')
  @RequirePermission('roles:UPDATE')
  async updatePermissions(
    @Param('id') id: string,
    @CurrentUser() user: JWTPayload,
    @Body() body: UpdateRolePermissionsDto,
  ) {
    await this.updateRolePermissionsUseCase.execute({
      roleId: id,
      tenantId: user.tenantId,
      permissions: body.permissions,
    });
    return { success: true };
  }

  @Delete(':id')
  @RequirePermission('roles:DELETE')
  async delete(@Param('id') id: string, @CurrentUser() user: JWTPayload) {
    await this.deleteRoleUseCase.execute({ roleId: id, tenantId: user.tenantId });
    return { success: true };
  }
}
