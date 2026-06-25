import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { JWTPayload } from '../../../application/ports/jwt.port';
import {
  GetNotificationHistoryUseCase,
  GetUnreadCountUseCase,
  MarkNotificationAsReadUseCase,
  MarkAllNotificationsReadUseCase,
} from '../../../application/use-cases/notifications/notifications.use-cases';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly history: GetNotificationHistoryUseCase,
    private readonly unread: GetUnreadCountUseCase,
    private readonly markRead: MarkNotificationAsReadUseCase,
    private readonly markAllRead: MarkAllNotificationsReadUseCase,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: JWTPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.history.execute(
      user.sub,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: JWTPayload) {
    return this.unread.execute(user.sub);
  }

  @Patch(':id/read')
  async read(@Param('id') id: string, @CurrentUser() user: JWTPayload) {
    await this.markRead.execute(id, user.sub);
    return { success: true };
  }

  @Patch('read-all')
  async readAll(@CurrentUser() user: JWTPayload) {
    await this.markAllRead.execute(user.sub);
    return { success: true };
  }
}
