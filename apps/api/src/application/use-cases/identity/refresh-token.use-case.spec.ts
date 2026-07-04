import { RefreshTokenUseCase } from './refresh-token.use-case';

function make() {
  const userRepo = {
    findById: jest
      .fn()
      .mockResolvedValue({
        id: 'user-1',
        tenantId: 'tenant-1',
        branchId: 'branch-1',
        roleId: 'role-1',
        isActive: true,
      }),
  };
  const refreshTokenRepo = {
    findByHash: jest.fn().mockResolvedValue({
      id: 'rt-1',
      userId: 'user-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    }),
    revoke: jest.fn().mockResolvedValue(undefined),
    create: jest.fn().mockResolvedValue(undefined),
  };
  const jwtService = { sign: jest.fn().mockReturnValue('new-access-token') };
  const useCase = new RefreshTokenUseCase(
    userRepo as never,
    refreshTokenRepo as never,
    jwtService as never,
  );
  return { useCase, userRepo, refreshTokenRepo, jwtService };
}

describe('RefreshTokenUseCase', () => {
  it('rejects an unknown refresh token', async () => {
    const { useCase, refreshTokenRepo } = make();
    refreshTokenRepo.findByHash.mockResolvedValue(null);
    await expect(useCase.execute({ refreshToken: 'bogus' })).rejects.toMatchObject({ status: 401 });
  });

  it('rejects a revoked refresh token', async () => {
    const { useCase, refreshTokenRepo } = make();
    refreshTokenRepo.findByHash.mockResolvedValue({
      id: 'rt-1',
      userId: 'user-1',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 10000),
    });
    await expect(useCase.execute({ refreshToken: 'x' })).rejects.toMatchObject({ status: 401 });
  });

  it('rejects an expired refresh token', async () => {
    const { useCase, refreshTokenRepo } = make();
    refreshTokenRepo.findByHash.mockResolvedValue({
      id: 'rt-1',
      userId: 'user-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(useCase.execute({ refreshToken: 'x' })).rejects.toMatchObject({ status: 401 });
  });

  it('rejects when the user no longer exists or is inactive', async () => {
    const { useCase, userRepo } = make();
    userRepo.findById.mockResolvedValue({ id: 'user-1', isActive: false });
    await expect(useCase.execute({ refreshToken: 'x' })).rejects.toMatchObject({ status: 401 });
  });

  it('revokes the used token and issues a new access + refresh token pair (rotation)', async () => {
    const { useCase, refreshTokenRepo, jwtService } = make();

    const result = await useCase.execute({ refreshToken: 'x' });

    expect(refreshTokenRepo.revoke).toHaveBeenCalledWith('rt-1');
    expect(jwtService.sign).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'user-1', tenantId: 'tenant-1' }),
    );
    expect(refreshTokenRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', revokedAt: null }),
    );
    expect(result.accessToken).toBe('new-access-token');
    expect(typeof result.refreshToken).toBe('string');
    expect(result.refreshToken).not.toBe('x');
  });
});
