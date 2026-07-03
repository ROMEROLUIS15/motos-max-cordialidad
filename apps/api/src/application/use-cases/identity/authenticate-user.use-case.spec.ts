import { UnauthorizedException } from '@nestjs/common';
import { AuthenticateUserUseCase } from './authenticate-user.use-case';

function fakeUser(overrides: Partial<{ isActive: boolean; passwordHash: string }> = {}) {
  return {
    id: 'u1',
    tenantId: 't1',
    branchId: 'b1',
    roleId: 'r1',
    email: 'a@b.com',
    fullName: 'Ana',
    passwordHash: 'hashed',
    isActive: overrides.isActive ?? true,
    updateLastLogin: jest.fn(),
  };
}

describe('AuthenticateUserUseCase', () => {
  const make = (opts: { user: ReturnType<typeof fakeUser> | null; passwordValid: boolean }) => {
    const userRepo = { findByEmail: jest.fn().mockResolvedValue(opts.user), save: jest.fn() };
    const refreshRepo = { create: jest.fn().mockResolvedValue({ id: 'rt1' }) };
    const passwordService = { verify: jest.fn().mockResolvedValue(opts.passwordValid) };
    const jwtService = { sign: jest.fn().mockReturnValue('access-token') };
    const useCase = new AuthenticateUserUseCase(
      userRepo as never,
      refreshRepo as never,
      passwordService as never,
      jwtService as never,
    );
    return { useCase, userRepo, refreshRepo };
  };

  const input = { email: 'a@b.com', password: 'pw', tenantId: 't1' };

  it('returns tokens for valid credentials', async () => {
    const { useCase, refreshRepo } = make({ user: fakeUser(), passwordValid: true });
    const out = await useCase.execute(input);
    expect(out.accessToken).toBe('access-token');
    expect(out.refreshToken).toBeDefined();
    expect(refreshRepo.create).toHaveBeenCalled();
  });

  it('throws on wrong password', async () => {
    const { useCase } = make({ user: fakeUser(), passwordValid: false });
    await expect(useCase.execute(input)).rejects.toThrow(UnauthorizedException);
  });

  it('throws when the user does not exist', async () => {
    const { useCase } = make({ user: null, passwordValid: true });
    await expect(useCase.execute(input)).rejects.toThrow(UnauthorizedException);
  });

  it('throws when the account is inactive', async () => {
    const { useCase } = make({ user: fakeUser({ isActive: false }), passwordValid: true });
    await expect(useCase.execute(input)).rejects.toThrow('inactive');
  });

  it('does not reveal inactive status when the password is wrong (anti-enumeration)', async () => {
    const { useCase } = make({ user: fakeUser({ isActive: false }), passwordValid: false });
    await expect(useCase.execute(input)).rejects.toThrow('Invalid credentials');
  });
});
