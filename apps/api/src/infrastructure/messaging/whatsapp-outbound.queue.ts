import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker, Job, ConnectionOptions, UnrecoverableError } from 'bullmq';
import { MetaApiError, MetaWhatsAppClient } from './meta-whatsapp.client';
import {
  WhatsAppRepository,
  WHATSAPP_REPOSITORY,
} from '../../domain/repositories/whatsapp.repository';
import { NotificationPort, NOTIFICATION_PORT } from '../../application/ports/notification.port';

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
  tenantId: string;
  to: string;
  content: string;
  /**
   * When set, the worker sends this pre-approved template instead of free
   * text. Used for messages outside the 24h customer-service window, where
   * Meta rejects free-form text (error 131047).
   */
  template?: { name: string; params: string[] };
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
    @Inject(NOTIFICATION_PORT) private readonly notification: NotificationPort,
  ) {
    this.queue = new Queue<OutboundJobData>(WHATSAPP_OUTBOUND_QUEUE, {
      connection: this.connection,
    });
  }

  async enqueue(data: OutboundJobData): Promise<void> {
    await this.queue.add('send', data, DEFAULT_JOB_OPTIONS);
  }

  /**
   * One delivery attempt. Extracted from the Worker callback for testability.
   * Permanent Meta errors (4xx) are rethrown as BullMQ UnrecoverableError so
   * the queue does not waste its remaining attempts on a call that can never
   * succeed (bad token, closed 24h window, malformed payload…).
   */
  async processJob(data: OutboundJobData): Promise<void> {
    try {
      const result = data.template
        ? await this.metaClient.sendTemplate(data.to, data.template.name, data.template.params)
        : await this.metaClient.sendText(data.to, data.content);
      await this.whatsappRepo.updateMessageStatus(data.messageId, 'SENT', result.waMessageId);
    } catch (error) {
      if (error instanceof MetaApiError && error.isPermanent) {
        throw Object.assign(new UnrecoverableError(error.message), {
          metaCode: error.metaCode,
        });
      }
      throw error;
    }
  }

  /**
   * Terminal failure: mark FAILED and surface it to the tenant's admins —
   * a silent FAILED row in the DB helps nobody notice a customer was never
   * notified. Never throws (runs inside the worker's event handler).
   *
   * The admin alert is skipped when the WhatsApp channel itself is not
   * provisioned (no phone id / token in the environment): every send fails
   * by definition then, and alerting on each would flood the inbox — one
   * warn log per failure is enough until the channel is configured.
   */
  async handleFinalFailure(data: OutboundJobData, error?: Error): Promise<void> {
    try {
      await this.whatsappRepo.updateMessageStatus(data.messageId, 'FAILED');
      // Jobs enqueued by a pre-2026-07 deploy lack tenantId; skip the alert
      // rather than crash Prisma with an undefined where-clause.
      if (!data.tenantId) return;
      if (!this.channelConfigured()) {
        this.logger.warn(
          `WhatsApp channel not configured (missing WHATSAPP_PHONE_NUMBER_ID/ACCESS_TOKEN) — message ${data.messageId} FAILED, admin alert skipped`,
        );
        return;
      }
      const metaCode = (error as { metaCode?: number | null } | undefined)?.metaCode ?? null;
      await this.notification.notifyAdmins(data.tenantId, {
        type: 'WHATSAPP_SEND_FAILED',
        phone: data.to,
        messageId: data.messageId,
        // 131047 = outside the 24h window without an approved template.
        metaCode,
      });
    } catch (notifyError) {
      this.logger.error(
        `Could not record/notify final failure for message ${data.messageId}`,
        notifyError as Error,
      );
    }
  }

  private channelConfigured(): boolean {
    return Boolean(process.env['WHATSAPP_PHONE_NUMBER_ID'] && process.env['WHATSAPP_ACCESS_TOKEN']);
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
      async (job: Job<OutboundJobData>) => this.processJob(job.data),
      { connection: this.connection },
    );

    // UnrecoverableError skips the remaining attempts, so 'failed' fires once
    // per job either way: after the last retry, or immediately on a 4xx.
    this.worker.on('failed', (job, error) => {
      if (!job) return;
      if (error instanceof UnrecoverableError || job.attemptsMade >= (job.opts.attempts ?? 1)) {
        void this.handleFinalFailure(job.data, error);
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue.close();
  }
}
