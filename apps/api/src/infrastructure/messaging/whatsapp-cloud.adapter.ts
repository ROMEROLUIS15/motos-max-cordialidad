import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { MessagingPort } from '../../application/ports/messaging.port';
import { WhatsAppRepository, WHATSAPP_REPOSITORY } from '../../domain/repositories/whatsapp.repository';
import { WhatsAppOutboundQueue } from './whatsapp-outbound.queue';
import { PrismaService } from '../persistence/prisma/prisma.service';

/**
 * MessagingPort implementation backed by WhatsApp Cloud API. Outbound messages
 * are persisted (status QUEUED) and pushed to the whatsapp-outbound queue; the
 * worker performs the actual Meta API call. Replaces MessagingStubAdapter.
 */
@Injectable()
export class WhatsAppCloudAdapter implements MessagingPort {
  private readonly logger = new Logger(WhatsAppCloudAdapter.name);

  constructor(
    @Inject(WHATSAPP_REPOSITORY) private readonly whatsappRepo: WhatsAppRepository,
    private readonly outbound: WhatsAppOutboundQueue,
    private readonly prisma: PrismaService,
  ) {}

  async sendManualMessage(customerId: string, content: string, tenantId: string): Promise<void> {
    await this.queueForCustomer(customerId, content, tenantId, null);
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
    await this.outbound.enqueue({ messageId, to: phone, content });
    return messageId;
  }
}
