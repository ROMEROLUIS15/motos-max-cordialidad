import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { InventoryPort } from '../../application/ports/inventory.port';
import { PartBranchStock } from '../../domain/entities/part-branch-stock.entity';
import { StockEntryType } from '../../domain/value-objects/stock-entry-type.vo';
import { PrismaService } from '../persistence/prisma/prisma.service';

/** Shape of the locked stock row read with SELECT ... FOR UPDATE. */
interface LockedStockRow {
  id: string;
  stockFisico: Prisma.Decimal;
  stockReservado: Prisma.Decimal;
}

/**
 * Real InventoryPort implementation over the three-level stock model.
 *
 * Every mutation runs inside a DB transaction and locks the affected stock
 * row(s) with SELECT ... FOR UPDATE before the read-modify-write, so concurrent
 * reservations/discounts on the same part cannot lose an update (which would
 * otherwise oversell stock). Multi-part operations lock and write every part in
 * a single transaction, so a mid-loop failure rolls back the whole change
 * instead of leaving stock half-discounted. Domain invariants stay in
 * PartBranchStock — the adapter only provides the transactional boundary.
 */
@Injectable()
export class InventoryAdapter implements InventoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async reserveStock(partId: string, branchId: string, quantity: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.ensureRow(tx, partId, branchId);
      const stock = await this.lockRow(tx, partId, branchId);
      if (!stock) return; // ensureRow guarantees a row; guard keeps types honest
      stock.reserve(quantity); // throws InsufficientStockException → rolls back
      await this.persistReservation(tx, stock);
    });
  }

  async releaseReservation(partId: string, branchId: string, quantity: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const stock = await this.lockRow(tx, partId, branchId);
      if (!stock) return;
      stock.releaseReservation(quantity);
      await this.persistReservation(tx, stock);
    });
  }

  async releaseAllReservations(workOrderId: string): Promise<void> {
    const { branchId, parts } = await this.workOrderParts(workOrderId);
    if (parts.length === 0) return;
    await this.prisma.$transaction(async (tx) => {
      for (const p of parts) {
        const stock = await this.lockRow(tx, p.partId, branchId);
        if (!stock) continue;
        stock.releaseReservation(p.quantity);
        await this.persistReservation(tx, stock);
      }
    });
  }

  async confirmStockDiscount(workOrderId: string, tenantId: string): Promise<void> {
    const { branchId, parts } = await this.workOrderParts(workOrderId);
    if (parts.length === 0) return;
    await this.prisma.$transaction(async (tx) => {
      for (const p of parts) {
        const stock = await this.lockRow(tx, p.partId, branchId);
        if (!stock) continue;
        stock.confirmDiscount(p.quantity); // throws → rolls back the whole discount
        await tx.partBranchStock.update({
          where: { id: stock.id },
          data: { stockFisico: stock.stockFisico, stockReservado: stock.stockReservado },
        });
        await tx.stockEntry.create({
          data: {
            id: randomUUID(),
            tenantId,
            partId: p.partId,
            branchId,
            type: StockEntryType.SALIDA,
            quantity: p.quantity,
            userId: 'system',
            referenceId: workOrderId,
            notes: 'Descuento por entrega de orden de trabajo',
          },
        });
      }
    });
  }

  /** Ensures a zeroed stock row exists so it can be locked FOR UPDATE. */
  private async ensureRow(
    tx: Prisma.TransactionClient,
    partId: string,
    branchId: string,
  ): Promise<void> {
    await tx.partBranchStock.upsert({
      where: { partId_branchId: { partId, branchId } },
      update: {},
      create: { id: randomUUID(), partId, branchId, stockFisico: 0, stockReservado: 0 },
    });
  }

  /**
   * Locks the part+branch row FOR UPDATE inside the transaction and hydrates the
   * domain entity. The row lock serializes concurrent callers on the same part.
   */
  private async lockRow(
    tx: Prisma.TransactionClient,
    partId: string,
    branchId: string,
  ): Promise<PartBranchStock | null> {
    const rows = await tx.$queryRaw<LockedStockRow[]>`
      SELECT "id", "stockFisico", "stockReservado"
      FROM "part_branch_stocks"
      WHERE "partId" = ${partId} AND "branchId" = ${branchId}
      FOR UPDATE
    `;
    const row = rows[0];
    if (!row) return null;
    return new PartBranchStock(
      row.id,
      partId,
      branchId,
      Number(row.stockFisico),
      Number(row.stockReservado),
    );
  }

  private async persistReservation(
    tx: Prisma.TransactionClient,
    stock: PartBranchStock,
  ): Promise<void> {
    await tx.partBranchStock.update({
      where: { id: stock.id },
      data: { stockReservado: stock.stockReservado },
    });
  }

  private async workOrderParts(
    workOrderId: string,
  ): Promise<{ branchId: string; parts: Array<{ partId: string; quantity: number }> }> {
    const wo = await this.prisma.workOrder.findUnique({
      where: { id: workOrderId },
      select: { branchId: true, parts: { select: { partId: true, quantity: true } } },
    });
    if (!wo) return { branchId: '', parts: [] };
    return {
      branchId: wo.branchId,
      parts: wo.parts.map((p) => ({ partId: p.partId, quantity: Number(p.quantity) })),
    };
  }
}
