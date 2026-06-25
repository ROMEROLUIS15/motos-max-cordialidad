import { PartBranchStock } from './part-branch-stock.entity';
import { InsufficientStockException } from '../exceptions/domain.exception';

const make = (fisico: number, reservado = 0) =>
  new PartBranchStock('s1', 'part-1', 'branch-1', fisico, reservado);

describe('PartBranchStock three-level invariant', () => {
  it('computes stockDisponible = fisico - reservado', () => {
    const s = make(10, 3);
    expect(s.stockDisponible).toBe(7);
  });

  it('reserve increases reservado when available', () => {
    const s = make(10, 0);
    s.reserve(4);
    expect(s.stockReservado).toBe(4);
    expect(s.stockDisponible).toBe(6);
  });

  it('reserve throws InsufficientStockException when not enough available', () => {
    const s = make(5, 4); // disponible = 1
    expect(() => s.reserve(2)).toThrow(InsufficientStockException);
    expect(s.stockReservado).toBe(4);
  });

  it('releaseReservation never goes below zero', () => {
    const s = make(10, 2);
    s.releaseReservation(5);
    expect(s.stockReservado).toBe(0);
  });

  it('confirmDiscount reduces both fisico and reservado', () => {
    const s = make(10, 4);
    s.confirmDiscount(3);
    expect(s.stockFisico).toBe(7);
    expect(s.stockReservado).toBe(1);
  });

  it('addStock increases fisico, removeStock checks availability', () => {
    const s = make(10, 8); // disponible = 2
    s.addStock(5);
    expect(s.stockFisico).toBe(15);
    expect(() => s.removeStock(10)).toThrow(InsufficientStockException);
    s.removeStock(5);
    expect(s.stockFisico).toBe(10);
  });

  it('adjust returns positive difference (gain) and negative (loss)', () => {
    const s = make(10);
    expect(s.adjust(13)).toBe(3);
    expect(s.stockFisico).toBe(13);
    expect(s.adjust(8)).toBe(-5);
    expect(s.stockFisico).toBe(8);
  });
});
