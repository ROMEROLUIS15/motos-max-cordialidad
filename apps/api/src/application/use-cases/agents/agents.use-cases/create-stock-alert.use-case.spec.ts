import { CreateStockAlertUseCase } from './create-stock-alert.use-case';

describe('CreateStockAlertUseCase', () => {
  it('notifies every admin user of the tenant and returns how many were notified', async () => {
    const notifications = {
      notifyUser: jest.fn().mockResolvedValue(undefined),
      notifyAdmins: jest.fn(),
    };
    const notificationRepo = {
      findAdminUserIds: jest.fn().mockResolvedValue(['admin-1', 'admin-2']),
    };
    const useCase = new CreateStockAlertUseCase(notifications as never, notificationRepo as never);

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      partId: 'part-1',
      partName: 'Bujia NGK',
      currentStock: 2,
      minStock: 5,
    });

    expect(result).toEqual({ notified: 2 });
    expect(notifications.notifyUser).toHaveBeenCalledTimes(2);
    expect(notifications.notifyUser).toHaveBeenCalledWith(
      'admin-1',
      expect.objectContaining({ type: 'STOCK_ALERT', resourceId: 'part-1' }),
    );
  });

  it('notifies nobody when the tenant has no admin users', async () => {
    const notifications = { notifyUser: jest.fn(), notifyAdmins: jest.fn() };
    const notificationRepo = { findAdminUserIds: jest.fn().mockResolvedValue([]) };
    const useCase = new CreateStockAlertUseCase(notifications as never, notificationRepo as never);

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      partId: 'part-1',
      partName: 'Bujia NGK',
      currentStock: 2,
      minStock: 5,
    });

    expect(result).toEqual({ notified: 0 });
    expect(notifications.notifyUser).not.toHaveBeenCalled();
  });
});
