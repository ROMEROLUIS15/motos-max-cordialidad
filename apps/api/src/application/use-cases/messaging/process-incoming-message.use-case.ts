import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  WhatsAppRepository,
  WHATSAPP_REPOSITORY,
  WhatsAppSessionRecord,
} from '../../../domain/repositories/whatsapp.repository';
import { LLMMessage } from '../../ports/llm-provider.port';
import { NotificationPort, NOTIFICATION_PORT } from '../../ports/notification.port';
import { RouterAgentPort, ROUTER_AGENT_PORT } from '../../ports/router-agent.port';
import { WhatsAppSenderPort, WHATSAPP_SENDER_PORT } from '../../ports/whatsapp-sender.port';
import { AgentsServicePort, AGENTS_SERVICE_PORT } from '../../ports/agents-service.port';
import { UserRepository, USER_REPOSITORY } from '../../../domain/repositories/user.repository';
import {
  CustomerRepository,
  CUSTOMER_REPOSITORY,
} from '../../../domain/repositories/customer.repository';
import {
  TenantRepository,
  TENANT_REPOSITORY,
} from '../../../domain/repositories/tenant.repository';

const UNANSWERED_MINUTES = 5;

export interface ProcessIncomingMessageInput {
  tenantId: string;
  from: string; // phone number
  content: string;
  waMessageId?: string;
}

@Injectable()
export class ProcessIncomingMessageUseCase {
  private readonly logger = new Logger(ProcessIncomingMessageUseCase.name);

  constructor(
    @Inject(WHATSAPP_REPOSITORY) private readonly whatsappRepo: WhatsAppRepository,
    @Inject(NOTIFICATION_PORT) private readonly notification: NotificationPort,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(ROUTER_AGENT_PORT) private readonly routerAgent: RouterAgentPort,
    @Inject(WHATSAPP_SENDER_PORT) private readonly whatsapp: WhatsAppSenderPort,
    @Inject(AGENTS_SERVICE_PORT) private readonly agents: AgentsServicePort,
    @Inject(CUSTOMER_REPOSITORY) private readonly customerRepo: CustomerRepository,
    @Inject(TENANT_REPOSITORY) private readonly tenantRepo: TenantRepository,
  ) {}

  async execute(input: ProcessIncomingMessageInput): Promise<void> {
    // Idempotency: Meta retries webhooks (at-least-once) and a captured request
    // could be replayed. Skip a message id we've already stored so the agent
    // doesn't run twice and the customer doesn't get duplicate replies.
    if (input.waMessageId && (await this.whatsappRepo.messageExistsByWaId(input.waMessageId))) {
      this.logger.log(`duplicate webhook for waMessageId=${input.waMessageId} — skipping`);
      return;
    }

    const customerId = await this.customerRepo.findIdByPhone(input.tenantId, input.from);

    let session = await this.whatsappRepo.findSessionByPhone(input.from, input.tenantId);
    if (!session) {
      session = {
        id: randomUUID(),
        tenantId: input.tenantId,
        customerId: customerId,
        phoneNumber: input.from,
        isAnonymous: customerId === null,
        lastMessageAt: new Date(),
        createdAt: new Date(),
      };
      await this.whatsappRepo.createSession(session);
      if (!customerId) {
        await this.notification.notifyAdmins(input.tenantId, {
          type: 'WHATSAPP_UNKNOWN_NUMBER',
          phone: input.from,
        });
      }
    }

    await this.whatsappRepo.createMessage({
      id: randomUUID(),
      sessionId: session.id,
      direction: 'INBOUND',
      content: input.content,
      status: 'DELIVERED',
      waMessageId: input.waMessageId ?? null,
      sentBy: null,
      isAi: false,
      createdAt: new Date(),
    });
    await this.whatsappRepo.touchSession(session.id, new Date());

    // Admin (OWNER) chats route to the Python AgentAdmin, not the customer agent.
    const owner = await this.users.findOwnerByWhatsappPhone(input.from, input.tenantId);
    if (owner) {
      await this.routeToAdminAgent(input);
      return;
    }

    if (await this.shouldActivateAgent(input.tenantId, session)) {
      await this.runAgent(input, session, customerId, null);
    }
  }

  private async routeToAdminAgent(input: ProcessIncomingMessageInput): Promise<void> {
    const accepted = await this.agents.routeAdminMessage({
      tenantId: input.tenantId,
      phoneNumber: input.from,
      message: input.content,
    });
    if (accepted) return;
    // Agents service unavailable → the admin must not be left without a reply.
    this.logger.warn(`AgentAdmin unavailable for ${input.from} — escalating`);
    await this.notification.notifyAdmins(input.tenantId, {
      type: 'WHATSAPP_AGENT_ERROR',
      phone: input.from,
    });
    await this.whatsapp.sendToPhone(
      input.tenantId,
      input.from,
      null,
      'No pude procesar tu consulta en este momento. Un miembro del equipo te responderá pronto.',
      null,
    );
  }

  private async shouldActivateAgent(
    tenantId: string,
    session: WhatsAppSessionRecord,
  ): Promise<boolean> {
    const recentlyAnswered = await this.whatsappRepo.lastInboundRespondedWithin(
      session.id,
      UNANSWERED_MINUTES,
    );
    if (recentlyAnswered) return false;
    const tenant = await this.tenantRepo.findById(tenantId);
    return this.isWithinBusinessHours(tenant?.businessHours);
  }

  private isWithinBusinessHours(businessHours: unknown): boolean {
    // No configured hours → assume always available (Fase 1 default).
    if (!businessHours || typeof businessHours !== 'object') return true;
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const now = new Date();
    const cfg = (businessHours as Record<string, { open: string; close: string }>)[
      days[now.getDay()]
    ];
    if (!cfg) return false;
    const current = now.getHours() * 60 + now.getMinutes();
    const [oh, om] = cfg.open.split(':').map(Number);
    const [ch, cm] = cfg.close.split(':').map(Number);
    return current >= oh * 60 + om && current <= ch * 60 + cm;
  }

  private async runAgent(
    input: ProcessIncomingMessageInput,
    session: WhatsAppSessionRecord,
    customerId: string | null,
    branchId: string | null,
  ): Promise<void> {
    try {
      const recentMessages = await this.whatsappRepo.findRecentMessages(session.id, 11);
      const history: LLMMessage[] = recentMessages.slice(0, 10).map((m) => ({
        role: m.direction === 'INBOUND' ? 'user' : 'assistant',
        content: m.content,
      }));
      const result = await this.routerAgent.process({
        tenantId: input.tenantId,
        branchId,
        customerId,
        isRegistered: customerId !== null,
        message: input.content,
        history,
      });

      await this.whatsapp.sendToPhone(
        input.tenantId,
        input.from,
        customerId,
        result.response,
        null,
      );

      if (result.escalated) {
        await this.notification.notifyAdmins(input.tenantId, {
          type: 'WHATSAPP_ESCALATED',
          sessionId: session.id,
        });
      }
    } catch (error) {
      this.logger.error(`RouterAgent failed for session ${session.id}`, error as Error);
      await this.notification.notifyAdmins(input.tenantId, {
        type: 'WHATSAPP_AGENT_ERROR',
        sessionId: session.id,
      });
    }
  }
}
