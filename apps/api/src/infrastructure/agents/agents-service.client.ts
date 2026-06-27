import { Injectable, Logger } from '@nestjs/common';

/**
 * Thin client to the Python agents microservice (Fase 2C). Used to forward
 * admin WhatsApp messages to AgentAdmin. Fire-and-confirm: the Python service
 * replies to the admin asynchronously (via the NestJS WhatsApp endpoint), so we
 * only need to know the request was accepted. Any failure → caller escalates.
 */
@Injectable()
export class AgentsServiceClient {
  private readonly logger = new Logger(AgentsServiceClient.name);
  private readonly baseUrl = process.env['AGENTS_BASE_URL'] ?? 'http://localhost:8000';
  private readonly timeoutMs = 8000;

  async routeAdminMessage(input: {
    tenantId: string;
    phoneNumber: string;
    message: string;
  }): Promise<boolean> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/agents/admin`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      if (!res.ok) {
        this.logger.warn(`agents /agents/admin returned ${res.status}`);
        return false;
      }
      return true;
    } catch (err) {
      this.logger.warn(`agents service unreachable: ${String(err)}`);
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
}
