import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UserRepository, USER_REPOSITORY } from '../../../domain/repositories/user.repository';
import { RoleRepository, ROLE_REPOSITORY } from '../../../domain/repositories/role.repository';

export interface AssignRoleInput {
  userId: string;
  roleId: string;
  tenantId: string;
}

@Injectable()
export class AssignRoleUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(ROLE_REPOSITORY) private readonly roleRepo: RoleRepository,
  ) {}

  async execute(input: AssignRoleInput): Promise<void> {
    const user = await this.userRepo.findById(input.userId, input.tenantId);
    if (!user) throw new NotFoundException('User not found');

    const role = await this.roleRepo.findById(input.roleId, input.tenantId);
    if (!role) throw new NotFoundException('Role not found');

    user.assignRole(input.roleId);
    await this.userRepo.save(user);
  }
}
