import { ForgotPasswordUseCase } from './forgot-password.use-case';

const activeUser = {
  id: 'user-1',
  tenantId: 'tenant-1',
  email: 'user@test.com',
  fullName: 'Juan Perez',
  isActive: true,
};

function make() {
  const mail = { sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined) };
  const userRepo = { findManyByEmail: jest.fn().mockResolvedValue([activeUser]) };
  const tokens = {
    deleteUnusedForUser: jest.fn().mockResolvedValue(undefined),
    create: jest.fn().mockResolvedValue(undefined),
  };
  const useCase = new ForgotPasswordUseCase(mail as never, userRepo as never, tokens as never);
  return { useCase, mail, userRepo, tokens };
}

const GENERIC_MESSAGE = 'Si el email está registrado, recibirás un link de recuperación.';

describe('ForgotPasswordUseCase', () => {
  it('returns the same generic message whether or not the email exists (anti-enumeration)', async () => {
    const { useCase, userRepo } = make();
    const foundResult = await useCase.execute('user@test.com');

    userRepo.findManyByEmail.mockResolvedValue([]);
    const notFoundResult = await useCase.execute('unknown@test.com');

    expect(foundResult).toEqual(notFoundResult);
    expect(foundResult).toEqual({ message: GENERIC_MESSAGE });
  });

  it('does nothing further when the email does not exist', async () => {
    const { useCase, userRepo, tokens } = make();
    userRepo.findManyByEmail.mockResolvedValue([]);
    await useCase.execute('unknown@test.com');
    expect(tokens.create).not.toHaveBeenCalled();
  });

  it('does not resolve an inactive user', async () => {
    const { useCase, userRepo, tokens } = make();
    userRepo.findManyByEmail.mockResolvedValue([{ ...activeUser, isActive: false }]);
    await useCase.execute('user@test.com');
    expect(tokens.create).not.toHaveBeenCalled();
  });

  it('does not resolve ambiguously when the email matches more than one tenant and no tenantId is given', async () => {
    const { useCase, userRepo, tokens } = make();
    userRepo.findManyByEmail.mockResolvedValue([
      activeUser,
      { ...activeUser, id: 'user-2', tenantId: 'tenant-2' },
    ]);
    await useCase.execute('user@test.com');
    expect(tokens.create).not.toHaveBeenCalled();
  });

  it('resolves deterministically to the matching tenant when tenantId is given, even if the email is shared', async () => {
    const { useCase, userRepo, tokens } = make();
    userRepo.findManyByEmail.mockResolvedValue([
      activeUser,
      { ...activeUser, id: 'user-2', tenantId: 'tenant-2' },
    ]);
    await useCase.execute('user@test.com', 'tenant-2');
    expect(tokens.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-2' }));
  });

  it('invalidates previously unused tokens before creating a new one', async () => {
    const { useCase, tokens } = make();
    await useCase.execute('user@test.com');
    expect(tokens.deleteUnusedForUser).toHaveBeenCalledWith('user-1');
    expect(tokens.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }));
  });

  it('never persists the raw token, only its SHA-256 hash', async () => {
    const { useCase, tokens } = make();
    await useCase.execute('user@test.com');
    const data = tokens.create.mock.calls[0][0];
    expect(data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('still returns the generic success message even if sending the email fails', async () => {
    const { useCase, mail } = make();
    mail.sendPasswordResetEmail.mockRejectedValue(new Error('smtp down'));
    await expect(useCase.execute('user@test.com')).resolves.toEqual({ message: GENERIC_MESSAGE });
  });
});
