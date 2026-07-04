import { GetPartDetailUseCase } from './get-part-detail.use-case';
import { Part } from '../../../../domain/entities/part.entity';
import { PartBranchStock } from '../../../../domain/entities/part-branch-stock.entity';

function makePart(): Part {
  const now = new Date();
  return new Part(
    'part-1',
    'tenant-1',
    'SKU-1',
    'Bujia NGK',
    'Motor',
    'unidad',
    5_000,
    8_000,
    null,
    null,
    null,
    null,
    null,
    null,
    true,
    now,
    now,
  );
}

function make() {
  const partRepo = { findById: jest.fn().mockResolvedValue(makePart()) };
  const stockRepo = { findByPartAndBranch: jest.fn().mockResolvedValue(null) };
  const useCase = new GetPartDetailUseCase(partRepo as never, stockRepo as never);
  return { useCase, partRepo, stockRepo };
}

describe('GetPartDetailUseCase', () => {
  it('throws NotFoundException when the part does not exist for the tenant', async () => {
    const { useCase, partRepo } = make();
    partRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('part-1', 'tenant-1')).rejects.toMatchObject({ status: 404 });
  });

  it('returns stock: null when no branchId is given', async () => {
    const { useCase, stockRepo } = make();
    const result = await useCase.execute('part-1', 'tenant-1');
    expect(result.stock).toBeNull();
    expect(stockRepo.findByPartAndBranch).not.toHaveBeenCalled();
  });

  it('returns the stock summary when a branchId is given and a stock row exists', async () => {
    const { useCase, stockRepo } = make();
    stockRepo.findByPartAndBranch.mockResolvedValue(
      new PartBranchStock('ps-1', 'part-1', 'branch-1', 10, 3),
    );

    const result = await useCase.execute('part-1', 'tenant-1', 'branch-1');

    expect(result.stock).toEqual({ stockFisico: 10, stockReservado: 3, stockDisponible: 7 });
  });

  it('returns stock: null when a branchId is given but no stock row exists yet', async () => {
    const { useCase } = make();
    const result = await useCase.execute('part-1', 'tenant-1', 'branch-1');
    expect(result.stock).toBeNull();
  });
});
