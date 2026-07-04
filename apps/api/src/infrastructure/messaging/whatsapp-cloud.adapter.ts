import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { MessagingPort } from '../../application/ports/messaging.port';
import { WhatsAppSenderPort } from '../../application/ports/whatsapp-sender.port';
import {
  WhatsAppRepository,
  WHATSAPP_REPOSITORY,
} from '../../domain/repositories/whatsapp.repository';
import { WhatsAppOutboundQueue } from './whatsapp-outbound.queue';
import { PrismaService } from '../persistence/prisma/prisma.service';

/**
 * MessagingPort implementation backed by WhatsApp Cloud API. Outbound messages
 * are persisted (status QUEUED) and pushed to the whatsapp-outbound queue; the
 * worker performs the actual Meta API call. Replaces MessagingStubAdapter.
 */
@Injectable()
export class WhatsAppCloudAdapter implements MessagingPort, WhatsAppSenderPort {
  private readonly logger = new Logger(WhatsAppCloudAdapter.name);

  constructor(
    @Inject(WHATSAPP_REPOSITORY) private readonly whatsappRepo: WhatsAppRepository,
    private readonly outbound: WhatsAppOutboundQueue,
    private readonly prisma: PrismaService,
  ) {}

  async sendManualMessage(customerId: string, content: string, tenantId: string): Promise<void> {
    await this.queueForCustomer(customerId, content, tenantId, null);
  }

  async sendOwnerMessage(tenantId: string, content: string): Promise<boolean> {
    const owner = await this.prisma.user.findFirst({
      where: { tenantId, isActive: true, whatsappPhone: { not: null }, role: { name: 'OWNER' } },
      select: { whatsappPhone: true },
    });
    let phone = owner?.whatsappPhone ?? null;
    if (!phone) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { whatsappPhone: true },
      });
      phone = tenant?.whatsappPhone ?? null;
    }
    if (!phone) {
      this.logger.warn(`No owner/tenant phone for tenant ${tenantId} — message not queued`);
      return false;
    }
    await this.sendToPhone(tenantId, phone, null, content, null);
    return true;
  }

  async sendDirectMessage(tenantId: string, phone: string, content: string): Promise<void> {
    await this.sendToPhone(tenantId, phone, null, content, null);
  }

  async sendWorkOrderCompletedNotification(wo: {
    customerId: string;
    orderNumber: string;
    tenantId: string;
  }): Promise<void> {
    await this.queueForCustomer(
      wo.customerId,
      `¡Tu moto está lista! La orden ${wo.orderNumber} ha sido completada. Puedes pasar a recogerla.`,
      wo.tenantId,
      null,
    );
  }

  async sendWaitingPartsNotification(wo: {
    customerId: string;
    orderNumber: string;
    tenantId: string;
  }): Promise<void> {
    await this.queueForCustomer(
      wo.customerId,
      `Tu orden ${wo.orderNumber} está en espera de repuestos. Te avisaremos cuando continúe.`,
      wo.tenantId,
      null,
    );
  }

  private async queueForCustomer(
    customerId: string,
    content: string,
    tenantId: string,
    sentBy: string | null,
  ): Promise<void> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId },
      select: { phone: true, whatsappPhone: true },
    });
    const phone = customer?.whatsappPhone ?? customer?.phone;
    if (!phone) {
      this.logger.warn(`No phone for customer ${customerId} — message not queued`);
      return;
    }
    await this.sendToPhone(tenantId, phone, customerId, content, sentBy);
  }

  /**
   * Millis of margin subtracted from the 24h window: a message enqueued at
   * 23h59m could still be retried past the deadline by the queue's backoff.
   */
  private static readonly WINDOW_MARGIN_MS = 30 * 60 * 1000;

  /** Records an OUTBOUND message and enqueues it. Reused by manual send use case. */
  async sendToPhone(
    tenantId: string,
    phone: string,
    customerId: string | null,
    content: string,
    sentBy: string | null,
  ): Promise<string> {
    let session = await this.whatsappRepo.findSessionByPhone(phone, tenantId);
    if (!session) {
      session = {
        id: randomUUID(),
        tenantId,
        customerId,
        phoneNumber: phone,
        isAnonymous: customerId === null,
        lastMessageAt: new Date(),
        createdAt: new Date(),
      };
      await this.whatsappRepo.createSession(session);
    }

    const messageId = randomUUID();
    await this.whatsappRepo.createMessage({
      id: messageId,
      sessionId: session.id,
      direction: 'OUTBOUND',
      content,
      status: 'QUEUED',
      waMessageId: null,
      sentBy,
      isAi: sentBy === null,
      createdAt: new Date(),
    });
    await this.whatsappRepo.touchSession(session.id, new Date());
    await this.outbound.enqueue({
      messageId,
      tenantId,
      to: phone,
      content,
      template: await this.templateIfWindowClosed(session.id, content),
    });
    return messageId;
  }

  /**
   * Meta only allows free-form text within 24h of the customer's last inbound
   * message; outside that window it rejects the send (error 131047). We know
   * the window state from our own message log, so the decision happens here,
   * before enqueueing: closed window + configured template → send the approved
   * utility template (WHATSAPP_UTILITY_TEMPLATE, one body param carrying the
   * message). Without a template we still try free text — it fails visibly
   * now (FAILED + admin notification) instead of silently.
   */
  private async templateIfWindowClosed(
    sessionId: string,
    content: string,
  ): Promise<{ name: string; params: string[] } | undefined> {
    const templateName = process.env['WHATSAPP_UTILITY_TEMPLATE'];
    if (!templateName) return undefined;
    const windowOpensAt = new Date(
      Date.now() - (24 * 60 * 60 * 1000 - WhatsAppCloudAdapter.WINDOW_MARGIN_MS),
    );
    const windowOpen = await this.whatsappRepo.hasInboundSince(sessionId, windowOpensAt);
    return windowOpen ? undefined : { name: templateName, params: [content] };
  }
}
