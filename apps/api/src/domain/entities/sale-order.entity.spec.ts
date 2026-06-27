import { SaleOrder, SalePaymentMethod, SaleOrderStatus } from './sale-order.entity';

function makeOrder(
  overrides: Partial<{
    salePrice: number;
    discount: number;
    total: number;
    method: SalePaymentMethod;
    downPayment: number;
    months: number | null;
    status: SaleOrderStatus;
  }> = {},
): SaleOrder {
  const now = new Date();
  const salePrice = overrides.salePrice ?? 20000000;
  const discount = overrides.discount ?? 0;
  const total = overrides.total ?? SaleOrder.computeTotal(salePrice, discount);
  return new SaleOrder(
    'so1',
    't1',
    'b1',
    'c1',
    'u1',
    'V-2026-000001',
    salePrice,
    discount,
    total,
    overrides.method ?? 'CASH',
    overrides.downPayment ?? 0,
    overrides.months ?? null,
    overrides.status ?? 'DRAFT',
    null,
    null,
    'user1',
    now,
    now,
  );
}

describe('SaleOrder invariants', () => {
  it('computes total = salePrice - discount', () => {
    expect(SaleOrder.computeTotal(20000000, 1500000)).toBe(18500000);
  });

  it('rejects a total that does not match salePrice - discount', () => {
    expect(() => makeOrder({ salePrice: 1000, discount: 100, total: 999 })).toThrow(/totalAmount/);
  });

  it('rejects discount greater than salePrice', () => {
    expect(() => makeOrder({ salePrice: 1000, discount: 2000, total: -1000 })).toThrow(/discount/);
  });

  it('rejects downPayment above total', () => {
    expect(() => makeOrder({ salePrice: 1000, downPayment: 5000 })).toThrow(/downPayment/);
  });

  it('requires financingMonths for a FINANCED sale', () => {
    expect(() => makeOrder({ method: 'FINANCED', months: null })).toThrow(/FINANCED/);
  });

  it('rejects financingMonths on a CASH sale', () => {
    expect(() => makeOrder({ method: 'CASH', months: 12 })).toThrow(/financingMonths/);
  });

  it('accepts a valid FINANCED sale', () => {
    expect(() => makeOrder({ method: 'FINANCED', months: 24, downPayment: 5000000 })).not.toThrow();
  });
});

describe('SaleOrder status machine', () => {
  it('DRAFT → CONFIRMED → CANCELLED', () => {
    const o = makeOrder();
    o.confirm();
    expect(o.status).toBe('CONFIRMED');
    o.cancel();
    expect(o.status).toBe('CANCELLED');
  });

  it('DRAFT → CANCELLED', () => {
    const o = makeOrder();
    o.cancel();
    expect(o.status).toBe('CANCELLED');
  });

  it('cannot confirm a cancelled order', () => {
    const o = makeOrder({ status: 'CANCELLED' });
    expect(() => o.confirm()).toThrow(/invalid sale order transition/);
  });

  it('cannot re-confirm (CONFIRMED → CONFIRMED is a no-op)', () => {
    const o = makeOrder({ status: 'CONFIRMED' });
    expect(() => o.confirm()).not.toThrow();
    expect(o.status).toBe('CONFIRMED');
  });

  it('attachContract stores the R2 key', () => {
    const o = makeOrder({ status: 'CONFIRMED' });
    expect(o.contractR2Key).toBeNull();
    o.attachContract('t1/sale-contracts/so1/V-2026-000001.pdf');
    expect(o.contractR2Key).toContain('V-2026-000001.pdf');
  });
});
