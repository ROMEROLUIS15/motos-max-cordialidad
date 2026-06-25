import { TransitionWorkOrderStatusUseCase } from './transition-work-order-status.use-case';
import { WorkOrder } from '../../../domain/entities/work-order.entity';
import { WorkOrderStatus } from '../../../domain/value-objects/work-order-status.vo';
import { WorkOrderRepository } from '../../../domain/repositories/work-order.repository';
import { InventoryPort } from '../../ports/inventory.port';
import { MessagingPort } from '../../ports/messaging.port';
import { NotificationPort } from '../../ports/notification.port';

function makeWorkOrder(status: WorkOrderStatus): WorkOrder {
  const now = new Date();
  return new WorkOrder(
    'wo-1', 'tenant-1', 'branch-1', 'WO-2026-000001', 'rec-1', 'veh-1', 'cust-1',
    'tech-1', 'GENERAL', 'desc', status, new Date(now.getTime() + 86400000), null, now, now, null,
  );
}

describe('TransitionWorkOrderStatusUseCase', () => {
  let workOrderRepo: jest.Mocked<WorkOrderRepository>;
  let inventory: jest.Mocked<InventoryPort>;
  let messaging: jest.Mocked<MessagingPort>;
  let notification: jest.Mocked<NotificationPort>;
  let useCase: TransitionWorkOrderStatusUseCase;

  beforeEach(() => {
    workOrderRepo = {
      findById: jest.fn(),
      save: jest.fn(),
      saveStatusHistory: jest.fn(),
    } as unknown as jest.Mocked<WorkOrderRepository>;
    inventory = {
      reserveStock: jest.fn(),
      releaseReservation: jest.fn(),
      releaseAllReservations: jest.fn(),
      confirmStockDiscount: jest.fn(),
    };
    messaging = {
      sendWorkOrderCompletedNotification: jest.fn(),
      sendWaitingPartsNotification: jest.fn(),
      sendManualMessage: jest.fn(),
    };
    notification = { notifyAdmins: jest.fn(), notifyUser: jest.fn() };
    useCase = new TransitionWorkOrderStatusUseCase(workOrderRepo, inventory, messaging, notification);
  });

  it('confirms stock discount and persists history when transitioning to DELIVERED', async () => {
    workOrderRepo.findById.mockResolvedValue(makeWorkOrder(WorkOrderStatus.COMPLETED));
    const out = await useCase.execute({
      workOrderId: 'wo-1', tenantId: 'tenant-1', changedBy: 'u1', newStatus: WorkOrderStatus.DELIVERED,
    });
    expect(inventory.confirmStockDiscount).toHaveBeenCalledWith('wo-1', 'tenant-1');
    expect(inventory.releaseAllReservations).not.toHaveBeenCalled();
    expect(workOrderRepo.save).toHaveBeenCalled();
    expect(workOrderRepo.saveStatusHistory).toHaveBeenCalledWith(
      expect.objectContaining({ newStatus: WorkOrderStatus.DELIVERED, previousStatus: WorkOrderStatus.COMPLETED }),
    );
    expect(out.newStatus).toBe(WorkOrderStatus.DELIVERED);
  });

  it('releases all reservations when transitioning to CANCELLED', async () => {
    workOrderRepo.findById.mockResolvedValue(makeWorkOrder(WorkOrderStatus.IN_PROGRESS));
    await useCase.execute({
      workOrderId: 'wo-1', tenantId: 'tenant-1', changedBy: 'u1', newStatus: WorkOrderStatus.CANCELLED,
    });
    expect(inventory.releaseAllReservations).toHaveBeenCalledWith('wo-1', 'tenant-1');
    expect(inventory.confirmStockDiscount).not.toHaveBeenCalled();
  });

  it('sends completed + admin notifications when transitioning to COMPLETED', async () => {
    workOrderRepo.findById.mockResolvedValue(makeWorkOrder(WorkOrderStatus.IN_PROGRESS));
    await useCase.execute({
      workOrderId: 'wo-1', tenantId: 'tenant-1', changedBy: 'u1', newStatus: WorkOrderStatus.COMPLETED,
      finalOdometer: 15000,
    });
    expect(messaging.sendWorkOrderCompletedNotification).toHaveBeenCalled();
    expect(notification.notifyAdmins).toHaveBeenCalledWith('tenant-1', expect.objectContaining({ type: 'WORK_ORDER_COMPLETED' }));
  });

  it('throws on invalid transition and does not persist', async () => {
    workOrderRepo.findById.mockResolvedValue(makeWorkOrder(WorkOrderStatus.DELIVERED));
    await expect(
      useCase.execute({ workOrderId: 'wo-1', tenantId: 'tenant-1', changedBy: 'u1', newStatus: WorkOrderStatus.CANCELLED }),
    ).rejects.toMatchObject({ code: 'WORK_ORDER_INVALID_TRANSITION' });
    expect(workOrderRepo.save).not.toHaveBeenCalled();
  });
});
