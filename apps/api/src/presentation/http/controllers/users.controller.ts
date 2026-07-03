import { Body, Controller, Delete, Get, Inject, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { PermissionGuard } from '../guards/permission.guard';
import { JWTPayload } from '../../../application/ports/jwt.port';
import {
  CreateUserUseCase,
  CreateUserInput,
} from '../../../application/use-cases/identity/create-user.use-case';
import { UpdateUserUseCase } from '../../../application/use-cases/identity/update-user.use-case';
import { AssignRoleUseCase } from '../../../application/use-cases/identity/assign-role.use-case';
import { UpdateUserDto } from '../dtos/update-user.dto';
import { UserRepository, USER_REPOSITORY } from '../../../domain/repositories/user.repository';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class UsersController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly updateUserUseCase: UpdateUserUseCase,
    private readonly assignRoleUseCase: AssignRoleUseCase,
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
  ) {}

  @Get()
  @RequirePermission('users:READ')
  async findAll(@CurrentUser() user: JWTPayload) {
    const users = await this.userRepo.findByTenant(user.tenantId);
    return users.map(({ passwordHash: _ph, ...u }) => u);
  }

  @Post()
  @RequirePermission('users:CREATE')
  async create(@CurrentUser() user: JWTPayload, @Body() body: Omit<CreateUserInput, 'tenantId'>) {
    const created = await this.createUserUseCase.execute({ ...body, tenantId: user.tenantId });
    const { passwordHash: _ph, ...safe } = created;
    return safe;
  }

  @Put(':id')
  @RequirePermission('users:UPDATE')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: JWTPayload,
    @Body() body: UpdateUserDto,
  ) {
    await this.updateUserUseCase.execute({
      ...body,
      userId: id,
      tenantId: user.tenantId,
    });
    return { success: true };
  }

  @Delete(':id')
  @RequirePermission('users:DELETE')
  async deactivate(@Param('id') id: string, @CurrentUser() user: JWTPayload) {
    await this.updateUserUseCase.execute({ userId: id, tenantId: user.tenantId, isActive: false });
    return { success: true };
  }
}
