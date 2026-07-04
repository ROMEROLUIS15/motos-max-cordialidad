import { UpdateUserUseCase } from './update-user.use-case';
import { User } from '../../../domain/entities/user.entity';

function makeUser(): User {
  const now = new Date();
  return new User(
    'user-1',
    'tenant-1',
    'branch-1',
    'role-1',
    'user@test.com',
    'old-hash',
    'Juan Perez',
    true,
    null,
    now,
    now,
  );
}

function make() {
  const userRepo = {
    findById: jest.fn().mockResolvedValue(makeUser()),
    findByEmail: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const passwordService = { hash: jest.fn().mockResolvedValue('new-hash') };
  const useCase = new UpdateUserUseCase(userRepo as never, passwordService as never);
  return { useCase, userRepo, passwordService };
}

describe('UpdateUserUseCase', () => {
  it('throws NotFoundException when the user does not exist for the tenant', async () => {
    const { useCase, userRepo } = make();
    userRepo.findById.mockResolvedValue(null);
    await expect(
      useCase.execute({ userId: 'user-1', tenantId: 'tenant-1', fullName: 'x' }),
    ).rejects.toMatchObject({
      status: 404,
    });
  });

  it('deactivates the user when isActive is set to false', async () => {
    const { useCase, userRepo } = make();
    await useCase.execute({ userId: 'user-1', tenantId: 'tenant-1', isActive: false });
    const saved = userRepo.save.mock.calls[0][0] as User;
    expect(saved.isActive).toBe(false);
  });

  it('throws ConflictException when changing to an email already used by another user', async () => {
    const { useCase, userRepo } = make();
    userRepo.findByEmail.mockResolvedValue({ id: 'other-user' });
    await expect(
      useCase.execute({ userId: 'user-1', tenantId: 'tenant-1', email: 'taken@test.com' }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('allows "changing" to the same email without conflict (no-op)', async () => {
    const { useCase, userRepo } = make();
    await useCase.execute({ userId: 'user-1', tenantId: 'tenant-1', email: 'user@test.com' });
    expect(userRepo.findByEmail).not.toHaveBeenCalled();
    expect(userRepo.save).toHaveBeenCalled();
  });

  it('hashes and updates the password when provided', async () => {
    const { useCase, userRepo, passwordService } = make();
    await useCase.execute({ userId: 'user-1', tenantId: 'tenant-1', password: 'NewSecret123' });
    expect(passwordService.hash).toHaveBeenCalledWith('NewSecret123');
    const saved = userRepo.save.mock.calls[0][0] as User;
    expect(saved.passwordHash).toBe('new-hash');
  });
});
