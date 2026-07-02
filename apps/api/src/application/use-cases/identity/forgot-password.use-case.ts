import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { MailService } from '../../../infrastructure/mail/mail.service';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

/**
 * Initiates the password-recovery flow for a given email address.
 *
 * ## Security design (Change 2 — password-recovery-security)
 *
 * ### Anti-enumeration
 * The response is **always** HTTP 200 with the same generic message, regardless of
 * whether the email exists in the system. This prevents attackers from discovering
 * which emails are registered (CWE-204 / OWASP A01).
 *
 * ### Single valid token per user
 * Before creating a new token, all previous **unused** tokens for the same user are
 * deleted (`deleteMany WHERE usedAt IS NULL`). This ensures that only the most
 * recently requested link is valid and prevents token accumulation.
 *
 * ### Token storage
 * The raw token (`randomBytes(32)`) is NEVER stored in the database. Only its
 * SHA-256 hash is persisted. The raw token is sent once via email and then discarded.
 *
 * ### Email failure handling
 * If Resend fails to deliver the email, the error is logged with ERROR severity for
 * internal alerting, but the HTTP response to the client remains 200. Leaking a 500
 * when the email exists (but SMTP fails) would break anti-enumeration.
 */
@Injectable()
export class ForgotPasswordUseCase {
  private readonly logger = new Logger(ForgotPasswordUseCase.name);

  constructor(
    private readonly mail: MailService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * @param email    The email address requesting the password reset.
   * @param tenantId Optional tenant scope. If provided, the user must belong to this tenant.
   * @returns        Always `{ message: '…' }` — never reveals whether the email exists.
   */
  async execute(email: string, tenantId?: string): Promise<{ message: string }> {
    const where: Record<string, unknown> = { email, isActive: true };
    if (tenantId) where['tenantId'] = tenantId;
    const user = await this.prisma.user.findFirst({ where });

    if (!user) {
      this.logger.warn(`forgot-password attempted for unknown email: ${email}`);
      return { message: 'Si el email está registrado, recibirás un link de recuperación.' };
    }

    // Invalidar tokens previos no usados antes de crear uno nuevo
    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    const raw = randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(raw).digest('hex');

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    try {
      await this.mail.sendPasswordResetEmail({ email: user.email, fullName: user.fullName }, raw);
      this.logger.log(`forgot-password: email sent to ${user.email}`);
    } catch (err) {
      this.logger.error(
        `forgot-password: SMTP FAILED for ${user.email} — ${(err as Error).message}`,
        (err as Error).stack,
      );
    }

    return { message: 'Si el email está registrado, recibirás un link de recuperación.' };
  }
}
