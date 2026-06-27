import { MotorcycleCatalogController } from './motorcycle-catalog.controller';

describe('MotorcycleCatalogController', () => {
  const controller = new MotorcycleCatalogController();

  it('lists brands (unique, sorted, includes the majors)', () => {
    const brands = controller.brands();
    expect(brands).toContain('Yamaha');
    expect(brands).toContain('Honda');
    expect(brands).toContain('Bajaj');
    expect(new Set(brands).size).toBe(brands.length);
    expect([...brands]).toEqual([...brands].sort());
  });

  it('searches by brand and returns model + year range', () => {
    const results = controller.search('yamaha');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.brand === 'Yamaha')).toBe(true);
    const fz = results.find((r) => r.model.includes('FZ'));
    expect(fz?.yearFrom).toBeGreaterThanOrEqual(1995);
  });

  it('searches by "brand model" tokens', () => {
    const results = controller.search('pulsar 200');
    expect(results.some((r) => r.brand === 'Bajaj' && r.model.includes('200'))).toBe(true);
  });

  it('respects the limit', () => {
    expect(controller.search('', '5')).toHaveLength(5);
  });
});
