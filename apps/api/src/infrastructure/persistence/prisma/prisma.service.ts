import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { getTraceId } from '../../observability/trace-context';

const SLOW_QUERY_MS = 1000;

@Injectable()
export class PrismaService
  extends PrismaClient<{ log: [{ emit: 'event'; level: 'query' }, 'info', 'warn', 'error'] }>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [{ emit: 'event', level: 'query' }, 'info', 'warn', 'error'],
    });
  }

  async onModuleInit(): Promise<void> {
    // Structured slow-query logging (> 1000ms) with the active trace id.
    this.$on('query', (e) => {
      if (e.duration >= SLOW_QUERY_MS) {
        this.logger.warn(
          JSON.stringify({ type: 'slow_query', durationMs: e.duration, query: e.query, traceId: getTraceId() }),
        );
      }
    });
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
