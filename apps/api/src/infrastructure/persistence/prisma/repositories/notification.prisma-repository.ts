import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  NotificationRepository,
  NotificationRecord,
} from '../../../../domain/repositories/notification.repository';
import { Pagination, PaginatedResult, paginationToSkipTake } from '../../../../domain/shared/pagination';

@Injectable()
export class NotificationPrismaRepository implements NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(notification: NotificationRecord): Promise<void> {
    await this.prisma.notification.create({ data: notification });
  }

  async listByUser(userId: string, pagination: Pagination): Promise<PaginatedResult<NotificationRecord>> {
    const { skip, take } = paginationToSkipTake(pagination);
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);
    return { items, total, page: pagination.page, pageSize: pagination.pageSize };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  async markRead(id: string, userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async pruneOldForUser(userId: string, keep: number): Promise<void> {
    const toKeep = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: keep,
      select: { id: true },
    });
    if (toKeep.length === 0) return;
    await this.prisma.notification.deleteMany({ where: { id: { in: toKeep.map((n) => n.id) } } });
  }

  async findAdminUserIds(tenantId: string): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: { tenantId, isActive: true, role: { name: { in: ['OWNER', 'ADMIN'] } } },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }
}
