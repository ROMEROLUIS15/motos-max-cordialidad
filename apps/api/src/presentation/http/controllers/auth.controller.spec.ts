import { BadRequestException } from '@nestjs/common';
import { AuthController } from './auth.controller';

/**
 * Server-side validation guard for the auth endpoints. These prove the backend
 * enforces its own rules even when the frontend Zod checks are bypassed (a raw
 * POST straight to the API). The use-cases must NOT be reached when the payload
 * is invalid.
 */
describe('AuthController — server-side validation', () => {
  const makeController = () => {
    const authenticateUser = { execute: jest.fn() };
    const refreshToken = { execute: jest.fn() };
    const revokeToken = { execute: jest.fn() };
    const forgotPassword = { execute: jest.fn().mockResolvedValue({ message: 'ok' }) };
    const resetPassword = { execute: jest.fn().mockResolvedValue({ message: 'ok' }) };
    const prisma = { authFailureLog: { create: jest.fn() } };
    const controller = new AuthController(
      authenticateUser as never,
      refreshToken as never,
      revokeToken as never,
      forgotPassword as never,
      resetPassword as never,
      prisma as never,
    );
    return { controller, authenticateUser, forgotPassword, resetPassword };
  };

  describe('login', () => {
    it('rejects a malformed email before touching the use-case', async () => {
      const { controller, authenticateUser } = makeController();
      const req = { ip: '1.1.1.1' } as never;
      await expect(controller.login({ email: 'not-an-email', password: 'x' }, req)).rejects.toThrow(
        BadRequestException,
      );
      expect(authenticateUser.execute).not.toHaveBeenCalled();
    });

    it('rejects an empty password before touching the use-case', async () => {
      const { controller, authenticateUser } = makeController();
      const req = { ip: '1.1.1.1' } as never;
      await expect(controller.login({ email: 'a@b.com', password: '' }, req)).rejects.toThrow(
        BadRequestException,
      );
      expect(authenticateUser.execute).not.toHaveBeenCalled();
    });
  });

  describe('reset-password', () => {
    const cases: Array<[string, string]> = [
      ['too short', 'Ab1'],
      ['no uppercase', 'nouppercase1'],
      ['no lowercase', 'NOLOWERCASE1'],
      ['no number', 'NoNumbersHere'],
    ];

    it.each(cases)('rejects a weak password (%s) even with a token', async (_label, password) => {
      const { controller, resetPassword } = makeController();
      await expect(
        controller.resetPassword({ token: 'valid-looking-token', password }),
      ).rejects.toThrow(BadRequestException);
      expect(resetPassword.execute).not.toHaveBeenCalled();
    });

    it('rejects a missing token', async () => {
      const { controller, resetPassword } = makeController();
      await expect(
        controller.resetPassword({ token: '', password: 'StrongPass9' }),
      ).rejects.toThrow(BadRequestException);
      expect(resetPassword.execute).not.toHaveBeenCalled();
    });

    it('accepts a compliant password + token and calls the use-case', async () => {
      const { controller, resetPassword } = makeController();
      await controller.resetPassword({ token: 'tok', password: 'StrongPass9' });
      expect(resetPassword.execute).toHaveBeenCalledWith('tok', 'StrongPass9');
    });
  });

  describe('forgot-password', () => {
    it('rejects a malformed email before touching the use-case', async () => {
      const { controller, forgotPassword } = makeController();
      await expect(controller.forgotPassword({ email: 'nope' })).rejects.toThrow(
        BadRequestException,
      );
      expect(forgotPassword.execute).not.toHaveBeenCalled();
    });

    it('accepts a valid email', async () => {
      const { controller, forgotPassword } = makeController();
      await controller.forgotPassword({ email: 'a@b.com' });
      expect(forgotPassword.execute).toHaveBeenCalled();
    });
  });
});
