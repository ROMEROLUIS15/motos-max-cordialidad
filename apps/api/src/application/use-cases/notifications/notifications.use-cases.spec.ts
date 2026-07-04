import {
  GetNotificationHistoryUseCase,
  GetUnreadCountUseCase,
  MarkNotificationAsReadUseCase,
  MarkAllNotificationsReadUseCase,
} from './notifications.use-cases';

describe('GetNotificationHistoryUseCase', () => {
  it('defaults to page 1 / pageSize 20 and forwards them to the repository', async () => {
    const repo = {
      listByUser: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
    };
    const useCase = new GetNotificationHistoryUseCase(repo as never);

    await useCase.execute('user-1');

    expect(repo.listByUser).toHaveBeenCalledWith('user-1', { page: 1, pageSize: 20 });
  });

  it('respects an explicit page and pageSize', async () => {
    const repo = {
      listByUser: jest.fn().mockResolvedValue({ items: [], total: 0, page: 2, pageSize: 10 }),
    };
    const useCase = new GetNotificationHistoryUseCase(repo as never);

    await useCase.execute('user-1', 2, 10);

    expect(repo.listByUser).toHaveBeenCalledWith('user-1', { page: 2, pageSize: 10 });
  });
});

describe('GetUnreadCountUseCase', () => {
  it('wraps the repository count in a { count } object', async () => {
    const repo = { unreadCount: jest.fn().mockResolvedValue(5) };
    const useCase = new GetUnreadCountUseCase(repo as never);
    await expect(useCase.execute('user-1')).resolves.toEqual({ count: 5 });
  });
});

describe('MarkNotificationAsReadUseCase', () => {
  it('delegates to the repository for the given notification and user', async () => {
    const repo = { markRead: jest.fn().mockResolvedValue(undefined) };
    const useCase = new MarkNotificationAsReadUseCase(repo as never);
    await useCase.execute('notif-1', 'user-1');
    expect(repo.markRead).toHaveBeenCalledWith('notif-1', 'user-1');
  });
});

describe('MarkAllNotificationsReadUseCase', () => {
  it('delegates to the repository for the given user', async () => {
    const repo = { markAllRead: jest.fn().mockResolvedValue(undefined) };
    const useCase = new MarkAllNotificationsReadUseCase(repo as never);
    await useCase.execute('user-1');
    expect(repo.markAllRead).toHaveBeenCalledWith('user-1');
  });
});
