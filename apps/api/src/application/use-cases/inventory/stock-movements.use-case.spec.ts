import {
  RegisterStockEntryUseCase,
  RegisterStockExitUseCase,
  AdjustInventoryUseCase,
  TransferStockBetweenBranchesUseCase,
  GetStockHistoryUseCase,
  GetLowStockUseCase,
  GetStockValuationUseCase,
} from './stock-movements.use-case';
import { PartBranchStock } from '../../../domain/entities/part-branch-stock.entity';
import { InsufficientStockException } from '../../../domain/exceptions/domain.exception';
import { StockEntryType } from '../../../domain/value-objects/stock-entry-type.vo';

const baseMovement = {
  tenantId: 'tenant-1',
  partId: 'part-1',
  branchId: 'branch-1',
  userId: 'user-1',
};

describe('RegisterStockEntryUseCase', () => {
  it('adds stock to the existing (or newly ensured) row and records an ENTRADA entry', async () => {
    const stock = new PartBranchStock('ps-1', 'part-1', 'branch-1', 10, 0);
    const stockRepo = { ensureExists: jest.fn().mockResolvedValue(stock), save: jest.fn() };
    const entryRepo = { create: jest.fn().mockResolvedValue(undefined) };
    const useCase = new RegisterStockEntryUseCase(stockRepo as never, entryRepo as never);

    await useCase.execute({ ...baseMovement, quantity: 5 });

    expect(stock.stockFisico).toBe(15);
    expect(stockRepo.save).toHaveBeenCalledWith(stock);
    expect(entryRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: StockEntryType.ENTRADA, quantity: 5 }),
    );
  });
});

describe('RegisterStockExitUseCase', () => {
  it('throws NotFoundException when there is no stock row for the part+branch', async () => {
    const stockRepo = { findByPartAndBranch: jest.fn().mockResolvedValue(null) };
    const entryRepo = { create: jest.fn() };
    const useCase = new RegisterStockExitUseCase(stockRepo as never, entryRepo as never);

    await expect(useCase.execute({ ...baseMovement, quantity: 1 })).rejects.toMatchObject({
      status: 404,
    });
    expect(entryRepo.create).not.toHaveBeenCalled();
  });

  it('propagates InsufficientStockException without recording an entry', async () => {
    const stock = new PartBranchStock('ps-1', 'part-1', 'branch-1', 2, 0);
    const stockRepo = { findByPartAndBranch: jest.fn().mockResolvedValue(stock), save: jest.fn() };
    const entryRepo = { create: jest.fn() };
    const useCase = new RegisterStockExitUseCase(stockRepo as never, entryRepo as never);

    await expect(useCase.execute({ ...baseMovement, quantity: 5 })).rejects.toThrow(
      InsufficientStockException,
    );
    expect(entryRepo.create).not.toHaveBeenCalled();
  });

  it('removes stock and records a SALIDA entry when there is enough available stock', async () => {
    const stock = new PartBranchStock('ps-1', 'part-1', 'branch-1', 10, 0);
    const stockRepo = { findByPartAndBranch: jest.fn().mockResolvedValue(stock), save: jest.fn() };
    const entryRepo = { create: jest.fn().mockResolvedValue(undefined) };
    const useCase = new RegisterStockExitUseCase(stockRepo as never, entryRepo as never);

    await useCase.execute({ ...baseMovement, quantity: 4 });

    expect(stock.stockFisico).toBe(6);
    expect(entryRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: StockEntryType.SALIDA, quantity: 4 }),
    );
  });
});

describe('AdjustInventoryUseCase', () => {
  it('rejects an adjustment without a justification (notes)', async () => {
    const stockRepo = { ensureExists: jest.fn(), save: jest.fn() };
    const entryRepo = { create: jest.fn() };
    const useCase = new AdjustInventoryUseCase(stockRepo as never, entryRepo as never);

    await expect(
      useCase.execute({ ...baseMovement, newPhysicalCount: 10, notes: '   ' }),
    ).rejects.toMatchObject({ status: 422 });
    expect(stockRepo.ensureExists).not.toHaveBeenCalled();
  });

  it('adjusts the physical count, returns the difference, and records an AJUSTE entry with that quantity', async () => {
    const stock = new PartBranchStock('ps-1', 'part-1', 'branch-1', 10, 0);
    const stockRepo = { ensureExists: jest.fn().mockResolvedValue(stock), save: jest.fn() };
    const entryRepo = { create: jest.fn().mockResolvedValue(undefined) };
    const useCase = new AdjustInventoryUseCase(stockRepo as never, entryRepo as never);

    const result = await useCase.execute({
      ...baseMovement,
      newPhysicalCount: 7,
      notes: 'Conteo fisico mensual',
    });

    expect(result).toEqual({ difference: -3 });
    expect(stock.stockFisico).toBe(7);
    expect(entryRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: StockEntryType.AJUSTE,
        quantity: -3,
        notes: 'Conteo fisico mensual',
      }),
    );
  });
});

describe('TransferStockBetweenBranchesUseCase', () => {
  it('rejects a transfer where origin and destination branches are the same', async () => {
    const stockRepo = { transferAtomically: jest.fn() };
    const useCase = new TransferStockBetweenBranchesUseCase(stockRepo as never);

    await expect(
      useCase.execute({ ...baseMovement, fromBranchId: 'b1', toBranchId: 'b1', quantity: 5 }),
    ).rejects.toMatchObject({ status: 422 });
    expect(stockRepo.transferAtomically).not.toHaveBeenCalled();
  });

  it('delegates to the atomic repository transfer when branches differ', async () => {
    const stockRepo = { transferAtomically: jest.fn().mockResolvedValue(undefined) };
    const useCase = new TransferStockBetweenBranchesUseCase(stockRepo as never);
    const input = { ...baseMovement, fromBranchId: 'b1', toBranchId: 'b2', quantity: 5 };

    await useCase.execute(input);

    expect(stockRepo.transferAtomically).toHaveBeenCalledWith(input);
  });
});

describe('GetStockHistoryUseCase', () => {
  it('defaults to page 1 / pageSize 20 and forwards filters', async () => {
    const entryRepo = {
      history: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
    };
    const useCase = new GetStockHistoryUseCase(entryRepo as never);

    await useCase.execute({ tenantId: 'tenant-1', partId: 'part-1' });

    expect(entryRepo.history).toHaveBeenCalledWith(
      { partId: 'part-1', branchId: undefined, from: undefined, to: undefined },
      'tenant-1',
      { page: 1, pageSize: 20 },
    );
  });
});

describe('GetLowStockUseCase', () => {
  it('delegates to the repository for the given branch and tenant', async () => {
    const stockRepo = { findLowStock: jest.fn().mockResolvedValue([]) };
    const useCase = new GetLowStockUseCase(stockRepo as never);
    await useCase.execute('branch-1', 'tenant-1');
    expect(stockRepo.findLowStock).toHaveBeenCalledWith('branch-1', 'tenant-1');
  });
});

describe('GetStockValuationUseCase', () => {
  it('delegates to the repository for the given branch and tenant', async () => {
    const stockRepo = { valuation: jest.fn().mockResolvedValue({ totalCost: 0, totalSale: 0 }) };
    const useCase = new GetStockValuationUseCase(stockRepo as never);
    await useCase.execute('branch-1', 'tenant-1');
    expect(stockRepo.valuation).toHaveBeenCalledWith('branch-1', 'tenant-1');
  });
});
