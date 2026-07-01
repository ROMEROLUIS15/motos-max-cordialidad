import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { MailService } from '../../../infrastructure/mail/mail.service';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

@Injectable()
export class ForgotPasswordUseCase {
  private readonly logger = new Logger(ForgotPasswordUseCase.name);

  constructor(
    private readonly mail: MailService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(email: string, tenantId?: string): Promise<{ message: string }> {
    const where: Record<string, unknown> = { email, isActive: true };
    if (tenantId) where['tenantId'] = tenantId;
    const user = await this.prisma.user.findFirst({ where });

    if (!user) {
      this.logger.warn(`forgot-password attempted for unknown email: ${email}`);
      return { message: 'Si el email está registrado, recibirás un link de recuperación.' };
    }

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
