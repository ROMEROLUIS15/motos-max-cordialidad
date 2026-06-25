import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  WhatsAppRepository,
  WHATSAPP_REPOSITORY,
  WhatsAppSessionRecord,
  MessageRecord,
} from '../../../domain/repositories/whatsapp.repository';
import { WhatsAppCloudAdapter } from '../../../infrastructure/messaging/whatsapp-cloud.adapter';
import { Pagination, PaginatedResult } from '../../../domain/shared/pagination';

export interface SendManualMessageInput {
  tenantId: string;
  sessionId: string;
  content: string;
  sentBy: string;
}

@Injectable()
export class SendManualMessageUseCase {
  constructor(
    @Inject(WHATSAPP_REPOSITORY) private readonly whatsappRepo: WhatsAppRepository,
    private readonly whatsapp: WhatsAppCloudAdapter,
  ) {}

  async execute(input: SendManualMessageInput): Promise<{ messageId: string }> {
    const session = await this.whatsappRepo.findSessionById(input.sessionId, input.tenantId);
    if (!session) throw new NotFoundException('Sesión no encontrada');
    const messageId = await this.whatsapp.sendToPhone(
      input.tenantId,
      session.phoneNumber,
      session.customerId,
      input.content,
      input.sentBy,
    );
    return { messageId };
  }
}

@Injectable()
export class ListSessionsUseCase {
  constructor(@Inject(WHATSAPP_REPOSITORY) private readonly whatsappRepo: WhatsAppRepository) {}

  async execute(tenantId: string, page = 1, pageSize = 20): Promise<PaginatedResult<WhatsAppSessionRecord>> {
    return this.whatsappRepo.listSessions(tenantId, { page, pageSize });
  }
}

@Injectable()
export class GetConversationHistoryUseCase {
  constructor(@Inject(WHATSAPP_REPOSITORY) private readonly whatsappRepo: WhatsAppRepository) {}

  async execute(
    sessionId: string,
    tenantId: string,
    page = 1,
    pageSize = 50,
  ): Promise<PaginatedResult<MessageRecord>> {
    const session = await this.whatsappRepo.findSessionById(sessionId, tenantId);
    if (!session) throw new NotFoundException('Sesión no encontrada');
    const pagination: Pagination = { page, pageSize };
    return this.whatsappRepo.listMessages(sessionId, pagination);
  }
}
