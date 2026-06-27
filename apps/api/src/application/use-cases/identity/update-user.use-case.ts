import { Inject, Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { UserRepository, USER_REPOSITORY } from '../../../domain/repositories/user.repository';
import { PasswordService } from '../../../infrastructure/auth/password.service';

export interface UpdateUserInput {
  userId: string;
  tenantId: string;
  fullName?: string;
  branchId?: string | null;
  isActive?: boolean;
  email?: string;
  password?: string;
}

@Injectable()
export class UpdateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    private readonly passwordService: PasswordService,
  ) {}

  async execute(input: UpdateUserInput): Promise<void> {
    const user = await this.userRepo.findById(input.userId, input.tenantId);
    if (!user) throw new NotFoundException('User not found');

    if (input.fullName !== undefined) user.fullName = input.fullName;
    if (input.branchId !== undefined) user.branchId = input.branchId;
    if (input.isActive === false) user.deactivate();
    if (input.isActive === true) user.activate();

    if (input.email !== undefined && input.email !== user.email) {
      const existing = await this.userRepo.findByEmail(input.email, input.tenantId);
      if (existing && existing.id !== user.id) {
        throw new ConflictException(`Email ${input.email} already registered in this tenant`);
      }
      user.changeEmail(input.email);
    }

    if (input.password) {
      user.changePassword(await this.passwordService.hash(input.password));
    }

    await this.userRepo.save(user);
  }
}
