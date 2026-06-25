import { Inject, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { RoleRepository, ROLE_REPOSITORY } from '../../../domain/repositories/role.repository';

export interface DeleteRoleInput {
  roleId: string;
  tenantId: string;
}

@Injectable()
export class DeleteRoleUseCase {
  constructor(@Inject(ROLE_REPOSITORY) private readonly roleRepo: RoleRepository) {}

  async execute(input: DeleteRoleInput): Promise<void> {
    const role = await this.roleRepo.findById(input.roleId, input.tenantId);
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem) throw new ConflictException('Cannot delete system roles');

    const userCount = await this.roleRepo.countUsersWithRole(input.roleId);
    if (userCount > 0) {
      throw new ConflictException(
        `Cannot delete role: ${userCount} user(s) are currently assigned to this role`,
      );
    }

    await this.roleRepo.delete(input.roleId);
  }
}
