import { ServiceCatalogItem } from './service-catalog.entity';

function make(): ServiceCatalogItem {
  const now = new Date();
  return new ServiceCatalogItem('s1', 't1', 'Cambio de aceite', null, 1, 50000, 'MAINTENANCE', true, now, now);
}

describe('ServiceCatalogItem', () => {
  it('deactivate sets isActive to false', () => {
    const item = make();
    item.deactivate();
    expect(item.isActive).toBe(false);
  });

  it('update changes only the provided fields', () => {
    const item = make();
    item.update({ name: 'Cambio de aceite premium', suggestedPrice: 80000 });
    expect(item.name).toBe('Cambio de aceite premium');
    expect(item.suggestedPrice).toBe(80000);
    expect(item.estimatedHours).toBe(1); // untouched
  });
});
