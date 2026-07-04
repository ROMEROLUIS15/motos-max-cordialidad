import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  WhatsAppRepository,
  WhatsAppSessionRecord,
  MessageRecord,
  MessageStatus,
  MessageDirection,
} from '../../../../domain/repositories/whatsapp.repository';
import {
  Pagination,
  PaginatedResult,
  paginationToSkipTake,
} from '../../../../domain/shared/pagination';

@Injectable()
export class WhatsAppPrismaRepository implements WhatsAppRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findSessionByPhone(
    phoneNumber: string,
    tenantId: string,
  ): Promise<WhatsAppSessionRecord | null> {
    return this.prisma.whatsAppSession.findFirst({ where: { phoneNumber, tenantId } });
  }

  async findSessionById(id: string, tenantId: string): Promise<WhatsAppSessionRecord | null> {
    return this.prisma.whatsAppSession.findFirst({ where: { id, tenantId } });
  }

  async createSession(session: WhatsAppSessionRecord): Promise<void> {
    await this.prisma.whatsAppSession.create({ data: session });
  }

  async touchSession(sessionId: string, at: Date): Promise<void> {
    await this.prisma.whatsAppSession.update({
      where: { id: sessionId },
      data: { lastMessageAt: at },
    });
  }

  async listSessions(
    tenantId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<WhatsAppSessionRecord>> {
    const { skip, take } = paginationToSkipTake(pagination);
    const [items, total] = await Promise.all([
      this.prisma.whatsAppSession.findMany({
        where: { tenantId },
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.whatsAppSession.count({ where: { tenantId } }),
    ]);
    return { items, total, page: pagination.page, pageSize: pagination.pageSize };
  }

  async createMessage(message: MessageRecord): Promise<void> {
    await this.prisma.message.create({ data: message });
  }

  async messageExistsByWaId(waMessageId: string): Promise<boolean> {
    const existing = await this.prisma.message.findFirst({
      where: { waMessageId },
      select: { id: true },
    });
    return existing !== null;
  }

  async listMessages(
    sessionId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<MessageRecord>> {
    const { skip, take } = paginationToSkipTake(pagination);
    const [rows, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.message.count({ where: { sessionId } }),
    ]);
    return {
      items: rows.map((r) => ({
        ...r,
        direction: r.direction as MessageDirection,
        status: r.status as MessageStatus,
      })),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
    };
  }

  async updateMessageStatus(
    messageId: string,
    status: MessageStatus,
    waMessageId?: string,
  ): Promise<void> {
    await this.prisma.message.update({
      where: { id: messageId },
      data: { status, ...(waMessageId ? { waMessageId } : {}) },
    });
  }

  async lastInboundRespondedWithin(sessionId: string, minutes: number): Promise<boolean> {
    const since = new Date(Date.now() - minutes * 60 * 1000);
    const outbound = await this.prisma.message.findFirst({
      where: { sessionId, direction: 'OUTBOUND', createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
    });
    return outbound !== null;
  }

  async hasInboundSince(sessionId: string, since: Date): Promise<boolean> {
    const inbound = await this.prisma.message.findFirst({
      where: { sessionId, direction: 'INBOUND', createdAt: { gte: since } },
      select: { id: true },
    });
    return inbound !== null;
  }

  async findRecentMessages(
    sessionId: string,
    limit: number,
  ): Promise<Array<{ direction: 'INBOUND' | 'OUTBOUND'; content: string }>> {
    const messages = await this.prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { direction: true, content: true },
    });
    return messages
      .map((m) => ({
        direction: m.direction as 'INBOUND' | 'OUTBOUND',
        content: m.content,
      }))
      .reverse();
  }
}
