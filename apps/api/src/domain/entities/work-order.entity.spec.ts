import { WorkOrder } from './work-order.entity';
import { WorkOrderStatus } from '../value-objects/work-order-status.vo';
import {
  WorkOrderInvalidTransitionException,
  DomainException,
} from '../exceptions/domain.exception';

function makeWorkOrder(status: WorkOrderStatus, promisedDeliveryAt = new Date(Date.now() + 86400000)): WorkOrder {
  const now = new Date();
  return new WorkOrder(
    'wo-1', 'tenant-1', 'branch-1', 'WO-2026-000001', 'rec-1', 'veh-1', 'cust-1',
    'tech-1', 'GENERAL', 'No arranca', status, promisedDeliveryAt, null, now, now, null,
  );
}

describe('WorkOrder state machine', () => {
  it('transitions PENDING → IN_PROGRESS and returns the change', () => {
    const wo = makeWorkOrder(WorkOrderStatus.PENDING);
    const change = wo.transitionTo(WorkOrderStatus.IN_PROGRESS);
    expect(wo.status).toBe(WorkOrderStatus.IN_PROGRESS);
    expect(change.previousStatus).toBe(WorkOrderStatus.PENDING);
    expect(change.newStatus).toBe(WorkOrderStatus.IN_PROGRESS);
  });

  it.each([
    [WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.WAITING_PARTS],
    [WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.COMPLETED],
    [WorkOrderStatus.WAITING_PARTS, WorkOrderStatus.IN_PROGRESS],
    [WorkOrderStatus.COMPLETED, WorkOrderStatus.DELIVERED],
    [WorkOrderStatus.PENDING, WorkOrderStatus.CANCELLED],
    [WorkOrderStatus.COMPLETED, WorkOrderStatus.CANCELLED],
  ])('allows valid transition %s → %s', (from, to) => {
    const wo = makeWorkOrder(from);
    expect(() => wo.transitionTo(to)).not.toThrow();
    expect(wo.status).toBe(to);
  });

  it('throws WORK_ORDER_INVALID_TRANSITION on DELIVERED → CANCELLED', () => {
    const wo = makeWorkOrder(WorkOrderStatus.DELIVERED);
    expect(() => wo.transitionTo(WorkOrderStatus.CANCELLED)).toThrow(
      WorkOrderInvalidTransitionException,
    );
  });

  it('throws on PENDING → COMPLETED (skipping states)', () => {
    const wo = makeWorkOrder(WorkOrderStatus.PENDING);
    try {
      wo.transitionTo(WorkOrderStatus.COMPLETED);
      fail('expected throw');
    } catch (e) {
      expect((e as WorkOrderInvalidTransitionException).code).toBe('WORK_ORDER_INVALID_TRANSITION');
    }
    expect(wo.status).toBe(WorkOrderStatus.PENDING);
  });

  it('treats DELIVERED and CANCELLED as terminal', () => {
    for (const terminal of [WorkOrderStatus.DELIVERED, WorkOrderStatus.CANCELLED]) {
      const wo = makeWorkOrder(terminal);
      for (const target of Object.values(WorkOrderStatus)) {
        expect(() => wo.transitionTo(target)).toThrow();
      }
    }
  });
});

describe('WorkOrder.isNearDeadline', () => {
  it('is true when promised delivery is within threshold and not terminal', () => {
    const wo = makeWorkOrder(WorkOrderStatus.IN_PROGRESS, new Date(Date.now() + 60 * 60 * 1000));
    expect(wo.isNearDeadline(2)).toBe(true);
  });

  it('is false when COMPLETED even if past deadline', () => {
    const wo = makeWorkOrder(WorkOrderStatus.COMPLETED, new Date(Date.now() - 60 * 60 * 1000));
    expect(wo.isNearDeadline(2)).toBe(false);
  });

  it('is false when deadline is far away', () => {
    const wo = makeWorkOrder(WorkOrderStatus.IN_PROGRESS, new Date(Date.now() + 10 * 60 * 60 * 1000));
    expect(wo.isNearDeadline(2)).toBe(false);
  });
});

describe('WorkOrder.softDelete', () => {
  it('marks deletedAt for a non-delivered order', () => {
    const wo = makeWorkOrder(WorkOrderStatus.PENDING);
    wo.softDelete();
    expect(wo.deletedAt).toBeInstanceOf(Date);
  });

  it('throws when the order is DELIVERED', () => {
    const wo = makeWorkOrder(WorkOrderStatus.DELIVERED);
    expect(() => wo.softDelete()).toThrow(DomainException);
  });
});
