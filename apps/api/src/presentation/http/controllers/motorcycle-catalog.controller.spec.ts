import { MotorcycleCatalogController } from './motorcycle-catalog.controller';
import {
  CustomMotorcycleModel,
  CustomMotorcycleModelRepository,
} from '../../../domain/repositories/custom-motorcycle-model.repository';
import { JWTPayload } from '../../../application/ports/jwt.port';

const user = { sub: 'u1', tenantId: 't1', branchId: null } as JWTPayload;

function makeController(custom: CustomMotorcycleModel[] = []) {
  const repo: CustomMotorcycleModelRepository = {
    listByTenant: jest.fn().mockResolvedValue(custom),
    create: jest.fn(),
    delete: jest.fn(),
  };
  return { controller: new MotorcycleCatalogController(repo), repo };
}

describe('MotorcycleCatalogController', () => {
  it('lists brands (base + custom, unique sorted)', async () => {
    const { controller } = makeController([
      { id: 'c1', tenantId: 't1', brand: 'MarcaX', model: 'M1', yearFrom: 2020, yearTo: null },
    ]);
    const brands = await controller.brands(user);
    expect(brands).toContain('Yamaha');
    expect(brands).toContain('MarcaX');
    expect(new Set(brands).size).toBe(brands.length);
  });

  it('searches base dataset by brand', async () => {
    const { controller } = makeController();
    const results = await controller.search(user, 'yamaha');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.brand === 'Yamaha')).toBe(true);
  });

  it('merges custom entries into the search', async () => {
    const { controller } = makeController([
      {
        id: 'c1',
        tenantId: 't1',
        brand: 'Yamaha',
        model: 'Custom999',
        yearFrom: 2024,
        yearTo: null,
      },
    ]);
    const results = await controller.search(user, 'yamaha');
    expect(results.some((r) => r.model === 'Custom999')).toBe(true);
  });

  it('respects the limit', async () => {
    const { controller } = makeController();
    expect(await controller.search(user, '', '5')).toHaveLength(5);
  });

  it('adds a custom model with defaults', async () => {
    const { controller, repo } = makeController();
    await controller.addCustom(user, { brand: 'Foo', model: 'Bar' });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't1', brand: 'Foo', model: 'Bar', yearFrom: 1995 }),
    );
  });
});
