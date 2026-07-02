import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

/**
 * Removes expired, unused password reset tokens every hour.
 * Used tokens (usedAt IS NOT NULL) are preserved for audit trail.
 */
@Injectable()
export class CleanupExpiredTokensJob {
  private readonly logger = new Logger(CleanupExpiredTokensJob.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handle(): Promise<void> {
    const { count } = await this.prisma.passwordResetToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
        usedAt: null,
      },
    });
    this.logger.log(`cleanup-expired-tokens: deleted ${count} expired unused token(s)`);
  }
}
