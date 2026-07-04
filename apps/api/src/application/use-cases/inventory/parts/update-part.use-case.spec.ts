import { UpdatePartUseCase } from './update-part.use-case';
import { Part } from '../../../../domain/entities/part.entity';

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
  const partRepo = {
    findById: jest.fn().mockResolvedValue(makePart()),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const useCase = new UpdatePartUseCase(partRepo as never);
  return { useCase, partRepo };
}

describe('UpdatePartUseCase', () => {
  it('throws NotFoundException when the part does not exist for the tenant', async () => {
    const { useCase, partRepo } = make();
    partRepo.findById.mockResolvedValue(null);
    await expect(
      useCase.execute({ tenantId: 'tenant-1', partId: 'part-1', name: 'x' }),
    ).rejects.toMatchObject({
      status: 404,
    });
  });

  it('updates only the provided simple fields, leaving prices untouched', async () => {
    const { useCase, partRepo } = make();
    await useCase.execute({
      tenantId: 'tenant-1',
      partId: 'part-1',
      name: 'Bujia Iridium',
      category: 'Encendido',
    });
    const saved = partRepo.save.mock.calls[0][0] as Part;
    expect(saved.name).toBe('Bujia Iridium');
    expect(saved.category).toBe('Encendido');
    expect(saved.costPrice).toBe(5_000);
    expect(saved.salePrice).toBe(8_000);
  });

  it('updates prices via the domain method when costPrice or salePrice is provided', async () => {
    const { useCase, partRepo } = make();
    await useCase.execute({ tenantId: 'tenant-1', partId: 'part-1', salePrice: 9_500 });
    const saved = partRepo.save.mock.calls[0][0] as Part;
    expect(saved.salePrice).toBe(9_500);
    expect(saved.costPrice).toBe(5_000);
  });

  it('rejects a price update that would make salePrice lower than costPrice', async () => {
    const { useCase } = make();
    await expect(
      useCase.execute({ tenantId: 'tenant-1', partId: 'part-1', salePrice: 1_000 }),
    ).rejects.toThrow('salePrice cannot be lower than costPrice');
  });

  it('clears a nullable field (e.g. minStockAlert) when explicitly set to null', async () => {
    const { useCase, partRepo } = make();
    partRepo.findById.mockResolvedValue(Object.assign(makePart(), { minStockAlert: 5 }));
    await useCase.execute({ tenantId: 'tenant-1', partId: 'part-1', minStockAlert: null });
    const saved = partRepo.save.mock.calls[0][0] as Part;
    expect(saved.minStockAlert).toBeNull();
  });
});
