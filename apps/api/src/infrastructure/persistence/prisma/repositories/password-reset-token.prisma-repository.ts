import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  PasswordResetTokenRepository,
  PasswordResetTokenRecord,
} from '../../../../domain/repositories/password-reset-token.repository';

@Injectable()
export class PasswordResetTokenPrismaRepository implements PasswordResetTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByTokenHash(tokenHash: string): Promise<PasswordResetTokenRecord | null> {
    const r = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!r) return null;
    return {
      id: r.id,
      userId: r.userId,
      tokenHash: r.tokenHash,
      expiresAt: r.expiresAt,
      usedAt: r.usedAt,
    };
  }

  async create(data: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void> {
    await this.prisma.passwordResetToken.create({ data });
  }

  async deleteUnusedForUser(userId: string): Promise<void> {
    await this.prisma.passwordResetToken.deleteMany({ where: { userId, usedAt: null } });
  }

  async consumeAndUpdatePassword(
    tokenId: string,
    userId: string,
    passwordHash: string,
  ): Promise<{ email: string; fullName: string }> {
    const [user] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
        select: { email: true, fullName: true },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: tokenId },
        data: { usedAt: new Date() },
      }),
    ]);
    return { email: user.email, fullName: user.fullName };
  }

  async deleteExpiredUnused(): Promise<number> {
    const { count } = await this.prisma.passwordResetToken.deleteMany({
      where: { expiresAt: { lt: new Date() }, usedAt: null },
    });
    return count;
  }
}
