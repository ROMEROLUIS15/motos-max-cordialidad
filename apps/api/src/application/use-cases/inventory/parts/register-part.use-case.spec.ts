import { RegisterPartUseCase } from './register-part.use-case';

function make() {
  const partRepo = {
    findBySku: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(undefined),
  };
  const stockRepo = { ensureExists: jest.fn().mockResolvedValue(undefined) };
  const useCase = new RegisterPartUseCase(partRepo as never, stockRepo as never);
  return { useCase, partRepo, stockRepo };
}

const baseInput = {
  tenantId: 'tenant-1',
  branchId: 'branch-1',
  sku: 'SKU-1',
  name: 'Bujia NGK',
  category: 'Motor',
  unit: 'unidad',
  costPrice: 5_000,
  salePrice: 8_000,
};

describe('RegisterPartUseCase', () => {
  it('throws ConflictException when the SKU already exists for the tenant', async () => {
    const { useCase, partRepo } = make();
    partRepo.findBySku.mockResolvedValue({ id: 'existing' });
    await expect(useCase.execute(baseInput)).rejects.toMatchObject({ status: 409 });
  });

  it('creates the part with null defaults for optional fields and ensures a stock row for the branch', async () => {
    const { useCase, partRepo, stockRepo } = make();
    const part = await useCase.execute(baseInput);

    expect(part.description).toBeNull();
    expect(part.brand).toBeNull();
    expect(part.minStockAlert).toBeNull();
    expect(part.isActive).toBe(true);
    expect(partRepo.create).toHaveBeenCalledWith(part);
    expect(stockRepo.ensureExists).toHaveBeenCalledWith(part.id, 'branch-1');
  });

  it('carries through optional fields when provided', async () => {
    const { useCase } = make();
    const part = await useCase.execute({
      ...baseInput,
      description: 'Bujia de iridio',
      brand: 'NGK',
      minStockAlert: 3,
    });
    expect(part.description).toBe('Bujia de iridio');
    expect(part.brand).toBe('NGK');
    expect(part.minStockAlert).toBe(3);
  });
});
