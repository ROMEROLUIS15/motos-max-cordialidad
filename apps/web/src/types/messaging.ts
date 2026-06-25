export interface WhatsAppSession {
  id: string;
  customerId: string | null;
  phoneNumber: string;
  isAnonymous: boolean;
  lastMessageAt: string | null;
}

export type MessageDirection = 'INBOUND' | 'OUTBOUND';
export type MessageStatus = 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'QUEUED';

export interface Message {
  id: string;
  sessionId: string;
  direction: MessageDirection;
  content: string;
  status: MessageStatus;
  isAi: boolean;
  createdAt: string;
}

export const STATUS_ICON: Record<MessageStatus, string> = {
  QUEUED: '🕓',
  SENT: '✓',
  DELIVERED: '✓✓',
  READ: '✓✓',
  FAILED: '⚠',
};
