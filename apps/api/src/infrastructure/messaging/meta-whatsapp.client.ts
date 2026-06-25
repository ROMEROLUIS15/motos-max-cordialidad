import { Injectable, Logger } from '@nestjs/common';
import { captureException } from '../observability/sentry';

export interface SendResult {
  waMessageId: string;
}

/**
 * Low-level client for the Meta WhatsApp Cloud API. Performs up to 3 attempts
 * with exponential backoff for transient HTTP errors.
 */
@Injectable()
export class MetaWhatsAppClient {
  private readonly logger = new Logger(MetaWhatsAppClient.name);
  private readonly phoneNumberId = process.env['WHATSAPP_PHONE_NUMBER_ID'] ?? '';
  private readonly token = process.env['WHATSAPP_ACCESS_TOKEN'] ?? '';

  async sendText(to: string, body: string): Promise<SendResult> {
    return this.post({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    });
  }

  async sendTemplate(to: string, templateName: string, params: string[]): Promise<SendResult> {
    return this.post({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'es' },
        components: [
          { type: 'body', parameters: params.map((text) => ({ type: 'text', text })) },
        ],
      },
    });
  }

  private async post(payload: unknown, attempt = 1): Promise<SendResult> {
    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${this.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Meta API HTTP ${res.status}`);
      const data = (await res.json()) as { messages?: Array<{ id: string }> };
      return { waMessageId: data.messages?.[0]?.id ?? '' };
    } catch (error) {
      if (attempt >= 3) {
        this.logger.error(`Meta send failed after ${attempt} attempts: ${(error as Error).message}`);
        captureException(error, { integration: 'meta_whatsapp' });
        throw error;
      }
      const backoff = attempt * 30_000; // 30s, 60s
      await new Promise((r) => setTimeout(r, backoff));
      return this.post(payload, attempt + 1);
    }
  }
}
