import { Pagination, PaginatedResult } from '../shared/pagination';

export type MessageDirection = 'INBOUND' | 'OUTBOUND';
export type MessageStatus = 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'QUEUED';

export interface WhatsAppSessionRecord {
  id: string;
  tenantId: string;
  customerId: string | null;
  phoneNumber: string;
  isAnonymous: boolean;
  lastMessageAt: Date | null;
  createdAt: Date;
}

export interface MessageRecord {
  id: string;
  sessionId: string;
  direction: MessageDirection;
  content: string;
  status: MessageStatus;
  waMessageId: string | null;
  sentBy: string | null;
  isAi: boolean;
  createdAt: Date;
}

export interface WhatsAppRepository {
  findSessionByPhone(phoneNumber: string, tenantId: string): Promise<WhatsAppSessionRecord | null>;
  findSessionById(id: string, tenantId: string): Promise<WhatsAppSessionRecord | null>;
  createSession(session: WhatsAppSessionRecord): Promise<void>;
  touchSession(sessionId: string, at: Date): Promise<void>;
  listSessions(tenantId: string, pagination: Pagination): Promise<PaginatedResult<WhatsAppSessionRecord>>;

  createMessage(message: MessageRecord): Promise<void>;
  listMessages(sessionId: string, pagination: Pagination): Promise<PaginatedResult<MessageRecord>>;
  updateMessageStatus(messageId: string, status: MessageStatus, waMessageId?: string): Promise<void>;
  lastInboundRespondedWithin(sessionId: string, minutes: number): Promise<boolean>;
}

export const WHATSAPP_REPOSITORY = Symbol('WhatsAppRepository');
