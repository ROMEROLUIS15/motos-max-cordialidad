import { DeactivatePartUseCase } from './deactivate-part.use-case';
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

describe('DeactivatePartUseCase', () => {
  it('throws NotFoundException when the part does not exist for the tenant', async () => {
    const partRepo = { findById: jest.fn().mockResolvedValue(null), save: jest.fn() };
    const useCase = new DeactivatePartUseCase(partRepo as never);
    await expect(useCase.execute('part-1', 'tenant-1')).rejects.toMatchObject({ status: 404 });
  });

  it('deactivates the part and persists it', async () => {
    const partRepo = {
      findById: jest.fn().mockResolvedValue(makePart()),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const useCase = new DeactivatePartUseCase(partRepo as never);
    await useCase.execute('part-1', 'tenant-1');
    const saved = partRepo.save.mock.calls[0][0] as Part;
    expect(saved.isActive).toBe(false);
  });
});
