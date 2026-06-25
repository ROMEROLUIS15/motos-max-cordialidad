import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ExpireQuotesUseCase } from './quote-lifecycle.use-case';

/** Daily job that transitions SENT quotes past their validUntil to EXPIRED. */
@Injectable()
export class ExpireQuotesJob {
  private readonly logger = new Logger(ExpireQuotesJob.name);

  constructor(private readonly expireQuotes: ExpireQuotesUseCase) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handle(): Promise<void> {
    try {
      const count = await this.expireQuotes.execute();
      if (count > 0) this.logger.log(`Expired ${count} quote(s)`);
    } catch (error) {
      this.logger.error('ExpireQuotes job failed', error as Error);
    }
  }
}
