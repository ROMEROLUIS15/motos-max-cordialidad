import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  PasswordResetTokenRepository,
  PASSWORD_RESET_TOKEN_REPOSITORY,
} from '../../../domain/repositories/password-reset-token.repository';

/**
 * Removes expired, unused password reset tokens every hour.
 * Used tokens (usedAt IS NOT NULL) are preserved for audit trail.
 */
@Injectable()
export class CleanupExpiredTokensJob {
  private readonly logger = new Logger(CleanupExpiredTokensJob.name);

  constructor(
    @Inject(PASSWORD_RESET_TOKEN_REPOSITORY)
    private readonly tokens: PasswordResetTokenRepository,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handle(): Promise<void> {
    const count = await this.tokens.deleteExpiredUnused();
    this.logger.log(`cleanup-expired-tokens: deleted ${count} expired unused token(s)`);
  }
}
