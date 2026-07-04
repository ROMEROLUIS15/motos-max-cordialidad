import { AssignRoleUseCase } from './assign-role.use-case';
import { User } from '../../../domain/entities/user.entity';

function makeUser(): User {
  const now = new Date();
  return new User(
    'user-1',
    'tenant-1',
    'branch-1',
    'role-old',
    'user@test.com',
    'hash',
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
    save: jest.fn().mockResolvedValue(undefined),
  };
  const roleRepo = { findById: jest.fn().mockResolvedValue({ id: 'role-new' }) };
  const useCase = new AssignRoleUseCase(userRepo as never, roleRepo as never);
  return { useCase, userRepo, roleRepo };
}

describe('AssignRoleUseCase', () => {
  it('throws NotFoundException when the user does not exist', async () => {
    const { useCase, userRepo } = make();
    userRepo.findById.mockResolvedValue(null);
    await expect(
      useCase.execute({ userId: 'user-1', roleId: 'role-new', tenantId: 'tenant-1' }),
    ).rejects.toMatchObject({
      status: 404,
    });
  });

  it('throws NotFoundException when the role does not exist for the tenant', async () => {
    const { useCase, roleRepo } = make();
    roleRepo.findById.mockResolvedValue(null);
    await expect(
      useCase.execute({ userId: 'user-1', roleId: 'role-new', tenantId: 'tenant-1' }),
    ).rejects.toMatchObject({
      status: 404,
    });
  });

  it('assigns the new role and persists the user', async () => {
    const { useCase, userRepo } = make();
    await useCase.execute({ userId: 'user-1', roleId: 'role-new', tenantId: 'tenant-1' });
    const saved = userRepo.save.mock.calls[0][0] as User;
    expect(saved.roleId).toBe('role-new');
  });
});
