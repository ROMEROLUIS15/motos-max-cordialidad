import { ConfirmSaleOrderUseCase } from './confirm-sale-order.use-case';
import { SaleOrder, SaleOrderStatus } from '../../../../domain/entities/sale-order.entity';
import { MotorcycleUnit } from '../../../../domain/entities/motorcycle-unit.entity';

function makeOrder(status: SaleOrderStatus = 'DRAFT'): SaleOrder {
  const now = new Date();
  return new SaleOrder(
    'order-1',
    'tenant-1',
    'branch-1',
    'cust-1',
    'unit-1',
    'SO-2026-000001',
    10_000_000,
    0,
    10_000_000,
    'CASH',
    0,
    null,
    status,
    null,
    null,
    'user-1',
    now,
    now,
  );
}

function makeUnit(): MotorcycleUnit {
  const now = new Date();
  return new MotorcycleUnit(
    'unit-1',
    'tenant-1',
    'branch-1',
    'VIN123',
    'Yamaha',
    'FZ',
    2024,
    150,
    'Rojo',
    'NEW',
    0,
    'ENG1',
    'ABC123',
    8_000_000,
    10_000_000,
    'RESERVED',
    null,
    null,
    now,
    now,
  );
}

function make() {
  const orderRepo = {
    findById: jest.fn().mockResolvedValue(makeOrder()),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const unitRepo = {
    findById: jest.fn().mockResolvedValue(makeUnit()),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const useCase = new ConfirmSaleOrderUseCase(orderRepo as never, unitRepo as never);
  return { useCase, orderRepo, unitRepo };
}

describe('ConfirmSaleOrderUseCase', () => {
  it('throws NotFoundException when the order does not exist', async () => {
    const { useCase, orderRepo } = make();
    orderRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('order-1', 'tenant-1')).rejects.toMatchObject({ status: 404 });
  });

  it('confirms the order and marks the unit as SOLD', async () => {
    const { useCase, orderRepo, unitRepo } = make();
    await useCase.execute('order-1', 'tenant-1');

    const savedOrder = orderRepo.save.mock.calls[0][0] as SaleOrder;
    expect(savedOrder.status).toBe('CONFIRMED');
    const savedUnit = unitRepo.save.mock.calls[0][0] as MotorcycleUnit;
    expect(savedUnit.status).toBe('SOLD');
  });

  it('throws UnprocessableEntityException for an already-cancelled order and does not persist', async () => {
    const { useCase, orderRepo, unitRepo } = make();
    orderRepo.findById.mockResolvedValue(makeOrder('CANCELLED'));
    await expect(useCase.execute('order-1', 'tenant-1')).rejects.toMatchObject({ status: 422 });
    expect(orderRepo.save).not.toHaveBeenCalled();
    expect(unitRepo.save).not.toHaveBeenCalled();
  });

  it('confirms the order even if the unit record is missing (does not touch the unit)', async () => {
    const { useCase, orderRepo, unitRepo } = make();
    unitRepo.findById.mockResolvedValue(null);
    await useCase.execute('order-1', 'tenant-1');
    expect(orderRepo.save).toHaveBeenCalled();
    expect(unitRepo.save).not.toHaveBeenCalled();
  });
});
