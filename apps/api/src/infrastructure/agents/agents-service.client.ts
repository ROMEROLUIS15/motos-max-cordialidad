import { Injectable, Logger } from '@nestjs/common';
import { AgentsServicePort } from '../../application/ports/agents-service.port';
import { TokenFactoryService } from '../../application/services/token-factory.service';

/**
 * Thin client to the Python agents microservice (Fase 2C). Used to forward
 * admin WhatsApp messages to AgentAdmin. Fire-and-confirm: the Python service
 * replies to the admin asynchronously (via the NestJS WhatsApp endpoint), so we
 * only need to know the request was accepted. Any failure → caller escalates.
 * Requests carry a short-lived service token (type:"service") — the agents
 * service rejects unauthenticated calls.
 */
@Injectable()
export class AgentsServiceClient implements AgentsServicePort {
  private readonly logger = new Logger(AgentsServiceClient.name);
  private readonly baseUrl = process.env['AGENTS_BASE_URL'] ?? 'http://localhost:8000';
  private readonly timeoutMs = 8000;

  constructor(private readonly tokenFactory: TokenFactoryService) {}

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
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.tokenFactory.createServiceToken()}`,
        },
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
