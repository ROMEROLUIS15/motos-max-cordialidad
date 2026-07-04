import { CreateUserUseCase } from './create-user.use-case';

function make() {
  const userRepo = {
    findByEmail: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(undefined),
  };
  const roleRepo = { findById: jest.fn().mockResolvedValue({ id: 'role-1' }) };
  const passwordService = { hash: jest.fn().mockResolvedValue('hashed-pw') };
  const useCase = new CreateUserUseCase(
    userRepo as never,
    roleRepo as never,
    passwordService as never,
  );
  return { useCase, userRepo, roleRepo, passwordService };
}

const baseInput = {
  tenantId: 'tenant-1',
  roleId: 'role-1',
  email: 'user@test.com',
  password: 'Secret123',
  fullName: 'Juan Perez',
};

describe('CreateUserUseCase', () => {
  it('throws ConflictException when the email is already registered in the tenant', async () => {
    const { useCase, userRepo } = make();
    userRepo.findByEmail.mockResolvedValue({ id: 'existing' });
    await expect(useCase.execute(baseInput)).rejects.toMatchObject({ status: 409 });
  });

  it('throws NotFoundException when the role does not exist for the tenant', async () => {
    const { useCase, roleRepo } = make();
    roleRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute(baseInput)).rejects.toMatchObject({ status: 404 });
  });

  it('hashes the password and creates an active user', async () => {
    const { useCase, userRepo, passwordService } = make();
    const user = await useCase.execute(baseInput);

    expect(passwordService.hash).toHaveBeenCalledWith('Secret123');
    expect(user.passwordHash).toBe('hashed-pw');
    expect(user.isActive).toBe(true);
    expect(userRepo.create).toHaveBeenCalledWith(user);
  });
});
