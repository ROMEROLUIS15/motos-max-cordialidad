import { DeliveryAlertsScheduler } from './delivery-alerts.scheduler';

function make() {
  const workOrderRepo = { findNearingDeadline: jest.fn().mockResolvedValue([]) };
  const notification = {
    notifyAdmins: jest.fn().mockResolvedValue(undefined),
    notifyUser: jest.fn(),
  };
  const messaging = { sendManualMessage: jest.fn().mockResolvedValue(undefined) };
  const tenantRepo = { findActive: jest.fn().mockResolvedValue([{ id: 'tenant-1' }]) };
  const scheduler = new DeliveryAlertsScheduler(
    workOrderRepo as never,
    notification as never,
    messaging as never,
    tenantRepo as never,
  );
  return { scheduler, workOrderRepo, notification, messaging, tenantRepo };
}

describe('DeliveryAlertsScheduler', () => {
  it('notifies admins and messages the customer for each order nearing its deadline, per tenant', async () => {
    const { scheduler, workOrderRepo, notification, messaging } = make();
    workOrderRepo.findNearingDeadline.mockResolvedValue([
      { id: 'wo-1', orderNumber: 'WO-1', customerId: 'cust-1' },
    ]);

    await scheduler.handle();

    expect(workOrderRepo.findNearingDeadline).toHaveBeenCalledWith(2, 'tenant-1');
    expect(notification.notifyAdmins).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ type: 'WORK_ORDER_NEAR_DEADLINE', workOrderId: 'wo-1' }),
    );
    expect(messaging.sendManualMessage).toHaveBeenCalledWith(
      'cust-1',
      expect.stringContaining('WO-1'),
      'tenant-1',
    );
  });

  it('processes every tenant returned by the repository, independently', async () => {
    const { scheduler, workOrderRepo, tenantRepo } = make();
    tenantRepo.findActive.mockResolvedValue([{ id: 'tenant-1' }, { id: 'tenant-2' }]);

    await scheduler.handle();

    expect(workOrderRepo.findNearingDeadline).toHaveBeenCalledWith(2, 'tenant-1');
    expect(workOrderRepo.findNearingDeadline).toHaveBeenCalledWith(2, 'tenant-2');
  });

  it('swallows a failed WhatsApp send and still completes without throwing', async () => {
    const { scheduler, workOrderRepo, messaging } = make();
    workOrderRepo.findNearingDeadline.mockResolvedValue([
      { id: 'wo-1', orderNumber: 'WO-1', customerId: 'cust-1' },
    ]);
    messaging.sendManualMessage.mockRejectedValue(new Error('whatsapp down'));

    await expect(scheduler.handle()).resolves.toBeUndefined();
  });

  it('logs and swallows an unexpected failure (e.g. DB down) without throwing', async () => {
    const { scheduler, tenantRepo } = make();
    tenantRepo.findActive.mockRejectedValue(new Error('db down'));
    await expect(scheduler.handle()).resolves.toBeUndefined();
  });
});
