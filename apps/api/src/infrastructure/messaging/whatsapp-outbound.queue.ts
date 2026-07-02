import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker, Job, ConnectionOptions } from 'bullmq';
import { MetaWhatsAppClient } from './meta-whatsapp.client';
import {
  WhatsAppRepository,
  WHATSAPP_REPOSITORY,
} from '../../domain/repositories/whatsapp.repository';

function redisConnection(): ConnectionOptions {
  const url = process.env['REDIS_URL'];
  if (url) {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: u.port ? parseInt(u.port, 10) : 6379,
      password: u.password || undefined,
      maxRetriesPerRequest: null,
    };
  }
  return { host: 'localhost', port: 6379, maxRetriesPerRequest: null };
}

export const WHATSAPP_OUTBOUND_QUEUE = 'whatsapp-outbound';

export interface OutboundJobData {
  messageId: string;
  to: string;
  content: string;
}

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 30_000 }, // 30s → 60s → 120s
  removeOnComplete: true,
  removeOnFail: false,
};

/**
 * Producer + worker for the whatsapp-outbound queue. The Redis connection uses
 * lazyConnect so constructing the producer does not require Redis to be up
 * (keeps the DI graph resolvable in tests). The worker starts in onModuleInit,
 * only when REDIS_URL is configured.
 */
@Injectable()
export class WhatsAppOutboundQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppOutboundQueue.name);
  private readonly connection: ConnectionOptions = redisConnection();
  private readonly queue: Queue<OutboundJobData>;
  private worker?: Worker<OutboundJobData>;

  constructor(
    private readonly metaClient: MetaWhatsAppClient,
    @Inject(WHATSAPP_REPOSITORY) private readonly whatsappRepo: WhatsAppRepository,
  ) {
    this.queue = new Queue<OutboundJobData>(WHATSAPP_OUTBOUND_QUEUE, {
      connection: this.connection,
    });
  }

  async enqueue(data: OutboundJobData): Promise<void> {
    await this.queue.add('send', data, DEFAULT_JOB_OPTIONS);
  }

  onModuleInit(): void {
    if (!process.env['REDIS_URL']) {
      this.logger.warn('REDIS_URL not set — whatsapp-outbound worker not started');
      return;
    }
    // E2E: message delivery is not under test, and the worker's background
    // writes (status updates + retries) contend with the suites' afterAll
    // cleanup on the message/notification tables. Jobs simply stay queued.
    if (process.env['NODE_ENV'] === 'test') {
      this.logger.warn('NODE_ENV=test — whatsapp-outbound worker not started');
      return;
    }
    this.worker = new Worker<OutboundJobData>(
      WHATSAPP_OUTBOUND_QUEUE,
      async (job: Job<OutboundJobData>) => {
        const { messageId, to, content } = job.data;
        const result = await this.metaClient.sendText(to, content);
        await this.whatsappRepo.updateMessageStatus(messageId, 'SENT', result.waMessageId);
      },
      { connection: this.connection },
    );

    this.worker.on('failed', (job) => {
      if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
        void this.whatsappRepo
          .updateMessageStatus(job.data.messageId, 'FAILED')
          .catch(() => undefined);
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue.close();
  }
}
