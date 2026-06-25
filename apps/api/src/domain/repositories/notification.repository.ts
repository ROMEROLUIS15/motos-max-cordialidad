import { Pagination, PaginatedResult } from '../shared/pagination';

export interface NotificationRecord {
  id: string;
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  resourceType: string | null;
  resourceId: string | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}

export interface NotificationRepository {
  create(notification: NotificationRecord): Promise<void>;
  listByUser(userId: string, pagination: Pagination): Promise<PaginatedResult<NotificationRecord>>;
  unreadCount(userId: string): Promise<number>;
  markRead(id: string, userId: string): Promise<void>;
  markAllRead(userId: string): Promise<void>;
  /** Keeps only the most recent `keep` notifications for a user. */
  pruneOldForUser(userId: string, keep: number): Promise<void>;
  /** User IDs with OWNER or ADMIN role in the tenant. */
  findAdminUserIds(tenantId: string): Promise<string[]>;
}

export const NOTIFICATION_REPOSITORY = Symbol('NotificationRepository');
