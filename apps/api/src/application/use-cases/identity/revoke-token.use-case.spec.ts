import { RevokeTokenUseCase } from './revoke-token.use-case';

describe('RevokeTokenUseCase', () => {
  it('throws UnauthorizedException for an unknown refresh token', async () => {
    const refreshTokenRepo = { findByHash: jest.fn().mockResolvedValue(null), revoke: jest.fn() };
    const useCase = new RevokeTokenUseCase(refreshTokenRepo as never);
    await expect(useCase.execute({ refreshToken: 'bogus' })).rejects.toMatchObject({ status: 401 });
    expect(refreshTokenRepo.revoke).not.toHaveBeenCalled();
  });

  it('revokes the token record found by hash', async () => {
    const refreshTokenRepo = {
      findByHash: jest.fn().mockResolvedValue({ id: 'rt-1' }),
      revoke: jest.fn().mockResolvedValue(undefined),
    };
    const useCase = new RevokeTokenUseCase(refreshTokenRepo as never);
    await useCase.execute({ refreshToken: 'valid-token' });
    expect(refreshTokenRepo.revoke).toHaveBeenCalledWith('rt-1');
  });
});
