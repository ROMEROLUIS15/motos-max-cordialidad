import { AddPartToWorkOrderUseCase } from './work-order-parts.use-case';
import { InsufficientStockException } from '../../../domain/exceptions/domain.exception';
import { WorkOrderStatus } from '../../../domain/value-objects/work-order-status.vo';

const workOrder = {
  id: 'wo1',
  branchId: 'b1',
  status: WorkOrderStatus.IN_PROGRESS,
};

function make(opts: { reserveThrows?: boolean }) {
  const workOrderRepo = {
    findById: jest.fn().mockResolvedValue(workOrder),
    addPart: jest.fn(),
  };
  const inventory = {
    reserveStock: opts.reserveThrows
      ? jest.fn().mockRejectedValue(new InsufficientStockException('p1', 5, 2))
      : jest.fn().mockResolvedValue(undefined),
  };
  const prisma = {
    part: { findFirst: jest.fn().mockResolvedValue({ salePrice: 1000 }) },
  };
  const useCase = new AddPartToWorkOrderUseCase(workOrderRepo as never, inventory as never, prisma as never);
  return { useCase, workOrderRepo, inventory };
}

describe('AddPartToWorkOrderUseCase', () => {
  const input = { tenantId: 't1', workOrderId: 'wo1', partId: 'p1', quantity: 2 };

  it('reserves stock and freezes the sale price when stock is sufficient', async () => {
    const { useCase, workOrderRepo, inventory } = make({});
    const record = await useCase.execute(input);
    expect(inventory.reserveStock).toHaveBeenCalledWith('p1', 'b1', 2, 't1');
    expect(record.unitPriceAtSale).toBe(1000);
    expect(workOrderRepo.addPart).toHaveBeenCalled();
  });

  it('propagates InsufficientStockException and does not persist the part', async () => {
    const { useCase, workOrderRepo } = make({ reserveThrows: true });
    await expect(useCase.execute(input)).rejects.toThrow(InsufficientStockException);
    expect(workOrderRepo.addPart).not.toHaveBeenCalled();
  });
});
