import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { ProcessIncomingMessageUseCase } from '../../../application/use-cases/messaging/process-incoming-message.use-case';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

/**
 * Meta WhatsApp webhook. GET verifies the subscription challenge; POST receives
 * inbound messages after validating the X-Hub-Signature-256 HMAC. No JWT.
 */
@Controller('webhooks/whatsapp')
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(
    private readonly processIncoming: ProcessIncomingMessageUseCase,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    if (mode === 'subscribe' && token === process.env['WHATSAPP_VERIFY_TOKEN']) {
      return challenge;
    }
    throw new UnauthorizedException('Verificación de webhook fallida');
  }

  @Post()
  async receive(@Req() req: RawBodyRequest<Request>): Promise<{ received: true }> {
    this.assertValidSignature(req);

    const body = req.body as MetaWebhookBody;
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        const displayPhone = value?.metadata?.display_phone_number;
        const tenantId = await this.resolveTenant(displayPhone);
        if (!tenantId) continue;

        for (const message of value?.messages ?? []) {
          if (message.type !== 'text' || !message.text) continue;
          await this.processIncoming.execute({
            tenantId,
            from: message.from,
            content: message.text.body,
            waMessageId: message.id,
          });
        }
      }
    }
    return { received: true };
  }

  private assertValidSignature(req: RawBodyRequest<Request>): void {
    const secret = process.env['WHATSAPP_APP_SECRET'];
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    if (!secret || !signature || !req.rawBody) {
      throw new UnauthorizedException('Firma de webhook ausente');
    }
    const expected = 'sha256=' + createHmac('sha256', secret).update(req.rawBody).digest('hex');
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Firma de webhook inválida');
    }
  }

  private async resolveTenant(displayPhone?: string): Promise<string | null> {
    if (!displayPhone) throw new BadRequestException('display_phone_number ausente');
    const normalized = displayPhone.replace(/\D/g, '');
    const tenant = await this.prisma.tenant.findFirst({
      where: { whatsappPhone: { contains: normalized } },
      select: { id: true },
    });
    return tenant?.id ?? null;
  }
}

interface MetaWebhookBody {
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: { display_phone_number?: string; phone_number_id?: string };
        messages?: Array<{
          from: string;
          id: string;
          type: string;
          text?: { body: string };
        }>;
      };
    }>;
  }>;
}
