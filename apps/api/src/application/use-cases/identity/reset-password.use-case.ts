import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { MailService } from '../../../infrastructure/mail/mail.service';
import { PasswordService } from '../../../infrastructure/auth/password.service';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

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
      throw new BadRequestException('Token inválido o ya utilizado.');
    }

    if (record.expiresAt < new Date()) {
      throw new BadRequestException('El token ha expirado. Solicita uno nuevo.');
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
      await this.mail.sendPasswordChangedNotification(user);
    }

    this.logger.log(`password reset successful for user ${record.userId}`);
    return { message: 'Contraseña actualizada exitosamente.' };
  }
}
