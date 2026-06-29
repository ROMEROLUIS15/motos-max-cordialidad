import { Inject, Injectable } from '@nestjs/common';
import { MessagingPort, MESSAGING_PORT } from '../../../../application/ports/messaging.port';

@Injectable()
export class SendOwnerWhatsAppUseCase {
  constructor(@Inject(MESSAGING_PORT) private readonly messaging: MessagingPort) {}

  async execute(tenantId: string, content: string) {
    const sent = await this.messaging.sendOwnerMessage(tenantId, content);
    return { sent };
  }
}
