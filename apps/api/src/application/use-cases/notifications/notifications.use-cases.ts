import { Inject, Injectable } from '@nestjs/common';
import {
  NotificationRepository,
  NOTIFICATION_REPOSITORY,
  NotificationRecord,
} from '../../../domain/repositories/notification.repository';
import { PaginatedResult } from '../../../domain/shared/pagination';

@Injectable()
export class GetNotificationHistoryUseCase {
  constructor(@Inject(NOTIFICATION_REPOSITORY) private readonly repo: NotificationRepository) {}

  async execute(userId: string, page = 1, pageSize = 20): Promise<PaginatedResult<NotificationRecord>> {
    return this.repo.listByUser(userId, { page, pageSize });
  }
}

@Injectable()
export class GetUnreadCountUseCase {
  constructor(@Inject(NOTIFICATION_REPOSITORY) private readonly repo: NotificationRepository) {}

  async execute(userId: string): Promise<{ count: number }> {
    return { count: await this.repo.unreadCount(userId) };
  }
}

@Injectable()
export class MarkNotificationAsReadUseCase {
  constructor(@Inject(NOTIFICATION_REPOSITORY) private readonly repo: NotificationRepository) {}

  async execute(id: string, userId: string): Promise<void> {
    await this.repo.markRead(id, userId);
  }
}

@Injectable()
export class MarkAllNotificationsReadUseCase {
  constructor(@Inject(NOTIFICATION_REPOSITORY) private readonly repo: NotificationRepository) {}

  async execute(userId: string): Promise<void> {
    await this.repo.markAllRead(userId);
  }
}
