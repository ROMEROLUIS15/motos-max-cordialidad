import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { MailService } from '../../../infrastructure/mail/mail.service';
import { PasswordService } from '../../../infrastructure/auth/password.service';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

/**
 * Validates a password-reset token and updates the user's password.
 *
 * ## Security design (Change 2 — password-recovery-security)
 *
 * ### Unified error messages
 * All token-validation failures (nonexistent, already used, expired) return the
 * **same** HTTP 400 message: `"Token inválido o expirado."`. Returning different
 * messages per failure case would allow attackers to enumerate token state
 * (CWE-203 — Observable Discrepancy).
 *
 * ### Token lookup strategy
 * The controller receives the raw token from the user. This use-case hashes it
 * with SHA-256 before querying the DB, so the raw token never touches the database.
 *
 * ### Atomic update
 * The password update and the token `usedAt` mark are executed inside a Prisma
 * `$transaction` to guarantee atomicity — a crash between the two writes cannot
 * leave the system in an inconsistent state.
 *
 * ### Post-reset notification
 * A "password changed" email is sent after the successful reset. If this email
 * fails, the error is logged but NOT propagated — the reset is already complete
 * and rolling it back would be worse than a missing notification.
 */
@Injectable()
export class ResetPasswordUseCase {
  private readonly logger = new Logger(ResetPasswordUseCase.name);

  constructor(
    private readonly mail: MailService,
    private readonly passwordService: PasswordService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(token: string, newPassword: string): Promise<{ message: string }> {
    const hash = createHash('sha256').update(token).digest('hex');

    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hash },
    });

    if (!record || record.usedAt) {
      throw new BadRequestException('Token inválido o expirado.');
    }

    if (record.expiresAt < new Date()) {
      throw new BadRequestException('Token inválido o expirado.');
    }

    const passwordHash = await this.passwordService.hash(newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    const user = await this.prisma.user.findUnique({
      where: { id: record.userId },
      select: { email: true, fullName: true },
    });

    if (user) {
      try {
        await this.mail.sendPasswordChangedNotification(user);
      } catch (error) {
        this.logger.error(
          `password-changed notification failed for ${user.email} — ${(error as Error).message}`,
        );
      }
    }

    this.logger.log(`password reset successful for user ${record.userId}`);
    return { message: 'Contraseña actualizada exitosamente.' };
  }
}
