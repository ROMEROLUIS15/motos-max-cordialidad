import { MotorcycleUnit, MotorcycleCondition, MotorcycleStatus } from './motorcycle-unit.entity';

function makeUnit(
  overrides: Partial<{
    condition: MotorcycleCondition;
    mileage: number;
    status: MotorcycleStatus;
    year: number;
    costPrice: number;
    salePrice: number;
  }> = {},
): MotorcycleUnit {
  const now = new Date();
  return new MotorcycleUnit(
    'u1',
    't1',
    'b1',
    'VIN123',
    'Yamaha',
    'MT-03',
    overrides.year ?? 2024,
    321,
    'Azul',
    overrides.condition ?? 'NEW',
    overrides.mileage ?? 0,
    null,
    null,
    overrides.costPrice ?? 1000,
    overrides.salePrice ?? 2000,
    overrides.status ?? 'AVAILABLE',
    null,
    null,
    now,
    now,
  );
}

describe('MotorcycleUnit invariants', () => {
  it('rejects empty vin', () => {
    expect(
      () =>
        new MotorcycleUnit(
          'u',
          't',
          'b',
          '',
          'Y',
          'M',
          2024,
          null,
          null,
          'NEW',
          0,
          null,
          null,
          1,
          2,
          'AVAILABLE',
          null,
          null,
          new Date(),
          new Date(),
        ),
    ).toThrow('vin cannot be empty');
  });

  it('rejects salePrice below costPrice', () => {
    expect(() => makeUnit({ costPrice: 2000, salePrice: 1000 })).toThrow(/salePrice/);
  });

  it('rejects a NEW unit with mileage', () => {
    expect(() => makeUnit({ condition: 'NEW', mileage: 100 })).toThrow(
      /NEW unit cannot have mileage/,
    );
  });

  it('allows a USED unit with mileage', () => {
    expect(() => makeUnit({ condition: 'USED', mileage: 5000 })).not.toThrow();
  });

  it('rejects an out-of-range year', () => {
    expect(() => makeUnit({ year: 1900 })).toThrow(/year/);
  });
});

describe('MotorcycleUnit status machine', () => {
  it('AVAILABLE → RESERVED → SOLD', () => {
    const u = makeUnit();
    u.changeStatus('RESERVED');
    expect(u.status).toBe('RESERVED');
    u.changeStatus('SOLD');
    expect(u.status).toBe('SOLD');
  });

  it('RESERVED → AVAILABLE (release)', () => {
    const u = makeUnit({ status: 'RESERVED' });
    u.changeStatus('AVAILABLE');
    expect(u.status).toBe('AVAILABLE');
  });

  it('SOLD is terminal', () => {
    const u = makeUnit({ status: 'SOLD' });
    expect(() => u.changeStatus('AVAILABLE')).toThrow(/invalid status transition/);
  });

  it('no-op when target equals current status', () => {
    const u = makeUnit();
    expect(() => u.changeStatus('AVAILABLE')).not.toThrow();
    expect(u.status).toBe('AVAILABLE');
  });
});
