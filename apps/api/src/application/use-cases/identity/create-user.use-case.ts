import { Inject, Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { User } from '../../../domain/entities/user.entity';
import { UserRepository, USER_REPOSITORY } from '../../../domain/repositories/user.repository';
import { RoleRepository, ROLE_REPOSITORY } from '../../../domain/repositories/role.repository';
import { PasswordService } from '../../../infrastructure/auth/password.service';

export interface CreateUserInput {
  tenantId: string;
  branchId?: string;
  roleId: string;
  email: string;
  password: string;
  fullName: string;
}

@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(ROLE_REPOSITORY) private readonly roleRepo: RoleRepository,
    private readonly passwordService: PasswordService,
  ) {}

  async execute(input: CreateUserInput): Promise<User> {
    const existing = await this.userRepo.findByEmail(input.email, input.tenantId);
    if (existing) throw new ConflictException(`Email ${input.email} already registered in this tenant`);

    const role = await this.roleRepo.findById(input.roleId, input.tenantId);
    if (!role) throw new NotFoundException('Role not found');

    const passwordHash = await this.passwordService.hash(input.password);
    const now = new Date();
    const user = new User(
      randomUUID(), input.tenantId, input.branchId ?? null,
      input.roleId, input.email, passwordHash, input.fullName,
      true, null, now, now,
    );
    await this.userRepo.create(user);
    return user;
  }
}
