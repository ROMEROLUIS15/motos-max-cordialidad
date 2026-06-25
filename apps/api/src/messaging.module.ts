import { Module } from '@nestjs/common';
import { PrismaModule } from './infrastructure/persistence/prisma/prisma.module';

import { WHATSAPP_REPOSITORY } from './domain/repositories/whatsapp.repository';
import { WhatsAppPrismaRepository } from './infrastructure/persistence/prisma/repositories/whatsapp.prisma-repository';
import { MESSAGING_PORT } from './application/ports/messaging.port';
import { MetaWhatsAppClient } from './infrastructure/messaging/meta-whatsapp.client';
import { WhatsAppOutboundQueue } from './infrastructure/messaging/whatsapp-outbound.queue';
import { WhatsAppCloudAdapter } from './infrastructure/messaging/whatsapp-cloud.adapter';

/**
 * Standalone messaging infrastructure (WhatsApp Cloud + outbound queue).
 * Depends only on Prisma, so it can be imported by Workshop/Commerce/AI without
 * creating dependency cycles. Provides the real MESSAGING_PORT.
 */
@Module({
  imports: [PrismaModule],
  providers: [
    { provide: WHATSAPP_REPOSITORY, useClass: WhatsAppPrismaRepository },
    MetaWhatsAppClient,
    WhatsAppOutboundQueue,
    WhatsAppCloudAdapter,
    { provide: MESSAGING_PORT, useClass: WhatsAppCloudAdapter },
  ],
  exports: [MESSAGING_PORT, WHATSAPP_REPOSITORY, WhatsAppCloudAdapter, WhatsAppOutboundQueue],
})
export class MessagingModule {}
