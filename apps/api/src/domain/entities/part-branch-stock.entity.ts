import { DomainException, InsufficientStockException } from '../exceptions/domain.exception';

/**
 * Three-level stock invariant per part+branch:
 *   stockDisponible = stockFisico - stockReservado
 *   0 <= stockReservado <= stockFisico
 */
export class PartBranchStock {
  constructor(
    public readonly id: string,
    public readonly partId: string,
    public readonly branchId: string,
    private _stockFisico: number,
    private _stockReservado: number,
  ) {}

  get stockFisico(): number {
    return this._stockFisico;
  }
  get stockReservado(): number {
    return this._stockReservado;
  }
  get stockDisponible(): number {
    return this._stockFisico - this._stockReservado;
  }

  reserve(quantity: number): void {
    if (this.stockDisponible < quantity) {
      throw new InsufficientStockException(this.partId, quantity, this.stockDisponible);
    }
    this._stockReservado += quantity;
  }

  releaseReservation(quantity: number): void {
    this._stockReservado = Math.max(0, this._stockReservado - quantity);
  }

  confirmDiscount(quantity: number): void {
    if (this._stockFisico < quantity) {
      throw new DomainException(
        'Stock físico insuficiente para confirmar descuento.',
        'INSUFFICIENT_PHYSICAL_STOCK',
      );
    }
    this._stockFisico -= quantity;
    this._stockReservado = Math.max(0, this._stockReservado - quantity);
  }

  addStock(quantity: number): void {
    if (quantity <= 0) throw new DomainException('La cantidad de entrada debe ser mayor a cero.', 'INVALID_STOCK_QUANTITY');
    this._stockFisico += quantity;
  }

  removeStock(quantity: number): void {
    if (quantity <= 0) throw new DomainException('La cantidad de salida debe ser mayor a cero.', 'INVALID_STOCK_QUANTITY');
    if (this.stockDisponible < quantity) {
      throw new InsufficientStockException(this.partId, quantity, this.stockDisponible);
    }
    this._stockFisico -= quantity;
  }

  /** Sets a new physical count and returns the difference (positive = gain, negative = loss). */
  adjust(newPhysicalCount: number): number {
    if (newPhysicalCount < 0) throw new DomainException('El conteo físico no puede ser negativo.', 'INVALID_STOCK_QUANTITY');
    const difference = newPhysicalCount - this._stockFisico;
    this._stockFisico = newPhysicalCount;
    return difference;
  }
}
