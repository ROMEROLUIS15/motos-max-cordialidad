import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UserRepository, USER_REPOSITORY } from '../../../domain/repositories/user.repository';

export interface UpdateUserInput {
  userId: string;
  tenantId: string;
  fullName?: string;
  branchId?: string | null;
  isActive?: boolean;
}

@Injectable()
export class UpdateUserUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly userRepo: UserRepository) {}

  async execute(input: UpdateUserInput): Promise<void> {
    const user = await this.userRepo.findById(input.userId, input.tenantId);
    if (!user) throw new NotFoundException('User not found');

    if (input.fullName !== undefined) user.fullName = input.fullName;
    if (input.branchId !== undefined) user.branchId = input.branchId;
    if (input.isActive === false) user.deactivate();
    if (input.isActive === true) user.activate();

    await this.userRepo.save(user);
  }
}
