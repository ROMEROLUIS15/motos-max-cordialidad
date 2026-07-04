import { createHash } from 'node:crypto';
import { ResetPasswordUseCase } from './reset-password.use-case';

const RAW_TOKEN = 'raw-token-abc';
const TOKEN_HASH = createHash('sha256').update(RAW_TOKEN).digest('hex');

function make() {
  const mail = { sendPasswordChangedNotification: jest.fn().mockResolvedValue(undefined) };
  const passwordService = { hash: jest.fn().mockResolvedValue('new-hash') };
  const tokens = {
    findByTokenHash: jest.fn().mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      tokenHash: TOKEN_HASH,
      usedAt: null,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    }),
    consumeAndUpdatePassword: jest
      .fn()
      .mockResolvedValue({ email: 'user@test.com', fullName: 'Juan Perez' }),
  };
  const useCase = new ResetPasswordUseCase(
    mail as never,
    passwordService as never,
    tokens as never,
  );
  return { useCase, mail, passwordService, tokens };
}

describe('ResetPasswordUseCase', () => {
  it('rejects with the same message when the token does not exist', async () => {
    const { useCase, tokens } = make();
    tokens.findByTokenHash.mockResolvedValue(null);
    await expect(useCase.execute(RAW_TOKEN, 'NewSecret123')).rejects.toMatchObject({
      status: 400,
      message: 'Token inválido o expirado.',
    });
  });

  it('rejects with the same message when the token was already used', async () => {
    const { useCase, tokens } = make();
    tokens.findByTokenHash.mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      tokenHash: TOKEN_HASH,
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 10000),
    });
    await expect(useCase.execute(RAW_TOKEN, 'NewSecret123')).rejects.toMatchObject({
      message: 'Token inválido o expirado.',
    });
  });

  it('rejects with the same message when the token has expired', async () => {
    const { useCase, tokens } = make();
    tokens.findByTokenHash.mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      tokenHash: TOKEN_HASH,
      usedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(useCase.execute(RAW_TOKEN, 'NewSecret123')).rejects.toMatchObject({
      message: 'Token inválido o expirado.',
    });
  });

  it('hashes the token to look it up, never queries with the raw value', async () => {
    const { useCase, tokens } = make();
    await useCase.execute(RAW_TOKEN, 'NewSecret123');
    expect(tokens.findByTokenHash).toHaveBeenCalledWith(TOKEN_HASH);
  });

  it('hashes the new password and delegates the atomic update to the repository, then notifies the user', async () => {
    const { useCase, tokens, mail, passwordService } = make();
    const result = await useCase.execute(RAW_TOKEN, 'NewSecret123');

    expect(passwordService.hash).toHaveBeenCalledWith('NewSecret123');
    expect(tokens.consumeAndUpdatePassword).toHaveBeenCalledWith('token-1', 'user-1', 'new-hash');
    expect(mail.sendPasswordChangedNotification).toHaveBeenCalledWith({
      email: 'user@test.com',
      fullName: 'Juan Perez',
    });
    expect(result).toEqual({ message: 'Contraseña actualizada exitosamente.' });
  });

  it('still succeeds even if the post-reset notification email fails', async () => {
    const { useCase, mail } = make();
    mail.sendPasswordChangedNotification.mockRejectedValue(new Error('smtp down'));
    await expect(useCase.execute(RAW_TOKEN, 'NewSecret123')).resolves.toEqual({
      message: 'Contraseña actualizada exitosamente.',
    });
  });
});
