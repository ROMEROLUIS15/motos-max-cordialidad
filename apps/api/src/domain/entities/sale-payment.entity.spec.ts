import { SalePayment } from './sale-payment.entity';

describe('SalePayment', () => {
  const make = (amount: number) =>
    new SalePayment('p1', 't1', 'so1', amount, 'CASH', null, null, new Date(), 'u1', new Date());

  it('accepts a positive amount', () => {
    expect(() => make(1000)).not.toThrow();
    expect(make(1000).amount).toBe(1000);
  });

  it('rejects a non-positive amount', () => {
    expect(() => make(0)).toThrow(/mayor a cero/);
    expect(() => make(-5)).toThrow(/mayor a cero/);
  });
});
