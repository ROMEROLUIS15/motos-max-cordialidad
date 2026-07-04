import { Injectable, Logger } from '@nestjs/common';
import { captureException } from '../observability/sentry';

export interface SendResult {
  waMessageId: string;
}

/**
 * Error from the Meta Graph API carrying the platform error code so callers
 * can react to specific failures (e.g. 131047 = outside the 24h customer
 * service window). 4xx errors are permanent — retrying cannot fix them.
 */
export class MetaApiError extends Error {
  constructor(
    readonly httpStatus: number,
    readonly metaCode: number | null,
    message: string,
  ) {
    super(message);
    this.name = 'MetaApiError';
  }

  /** Client errors (4xx) are permanent: bad token, bad payload, closed window… */
  get isPermanent(): boolean {
    return this.httpStatus >= 400 && this.httpStatus < 500;
  }
}

/**
 * Low-level client for the Meta WhatsApp Cloud API. Transient failures (5xx,
 * network) are retried up to 3 attempts with backoff; permanent 4xx errors
 * fail fast with the parsed Meta error code.
 */
@Injectable()
export class MetaWhatsAppClient {
  private readonly logger = new Logger(MetaWhatsAppClient.name);
  private readonly phoneNumberId = process.env['WHATSAPP_PHONE_NUMBER_ID'] ?? '';
  private readonly token = process.env['WHATSAPP_ACCESS_TOKEN'] ?? '';
  // Graph API versions are supported ~2 years; bump via env without a deploy.
  private readonly apiVersion = process.env['WHATSAPP_API_VERSION'] ?? 'v21.0';

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
        components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }],
      },
    });
  }

  private async post(payload: unknown, attempt = 1): Promise<SendResult> {
    try {
      const res = await fetch(
        `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.token}`,
          },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const metaError = await this.parseError(res);
        throw metaError;
      }
      const data = (await res.json()) as { messages?: Array<{ id: string }> };
      return { waMessageId: data.messages?.[0]?.id ?? '' };
    } catch (error) {
      const permanent = error instanceof MetaApiError && error.isPermanent;
      if (permanent || attempt >= 3) {
        this.logger.error(
          `Meta send failed (attempt ${attempt}${permanent ? ', permanent' : ''}): ${(error as Error).message}`,
        );
        captureException(error, { integration: 'meta_whatsapp' });
        throw error;
      }
      await this.sleep(attempt * 30_000); // 30s, 60s
      return this.post(payload, attempt + 1);
    }
  }

  private async parseError(res: Response): Promise<MetaApiError> {
    let code: number | null = null;
    let detail = '';
    try {
      const body = (await res.json()) as { error?: { code?: number; message?: string } };
      code = body.error?.code ?? null;
      detail = body.error?.message ?? '';
    } catch {
      // Non-JSON error body — keep the HTTP status only.
    }
    return new MetaApiError(
      res.status,
      code,
      `Meta API HTTP ${res.status}${code ? ` (code ${code})` : ''}${detail ? `: ${detail}` : ''}`,
    );
  }

  /** Wrapped so tests can stub the backoff wait. */
  protected sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
