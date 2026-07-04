import { Module } from '@nestjs/common';
import { PrismaModule } from './infrastructure/persistence/prisma/prisma.module';
import { NotificationsModule } from './notifications.module';

import { WHATSAPP_REPOSITORY } from './domain/repositories/whatsapp.repository';
import { WhatsAppPrismaRepository } from './infrastructure/persistence/prisma/repositories/whatsapp.prisma-repository';
import { MESSAGING_PORT } from './application/ports/messaging.port';
import { WHATSAPP_SENDER_PORT } from './application/ports/whatsapp-sender.port';
import { MetaWhatsAppClient } from './infrastructure/messaging/meta-whatsapp.client';
import { WhatsAppOutboundQueue } from './infrastructure/messaging/whatsapp-outbound.queue';
import { WhatsAppCloudAdapter } from './infrastructure/messaging/whatsapp-cloud.adapter';

/**
 * Standalone messaging infrastructure (WhatsApp Cloud + outbound queue).
 * Depends on Prisma and Notifications (delivery-failure alerts) — neither
 * imports Messaging back, so Workshop/Commerce/AI can import this module
 * without creating dependency cycles. Provides the real MESSAGING_PORT.
 */
@Module({
  imports: [PrismaModule, NotificationsModule],
  providers: [
    { provide: WHATSAPP_REPOSITORY, useClass: WhatsAppPrismaRepository },
    MetaWhatsAppClient,
    WhatsAppOutboundQueue,
    WhatsAppCloudAdapter,
    { provide: MESSAGING_PORT, useClass: WhatsAppCloudAdapter },
    { provide: WHATSAPP_SENDER_PORT, useClass: WhatsAppCloudAdapter },
  ],
  exports: [
    MESSAGING_PORT,
    WHATSAPP_SENDER_PORT,
    WHATSAPP_REPOSITORY,
    WhatsAppCloudAdapter,
    WhatsAppOutboundQueue,
  ],
})
export class MessagingModule {}
