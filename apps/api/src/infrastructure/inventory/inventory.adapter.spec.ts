import { InventoryAdapter } from './inventory.adapter';
import { PrismaService } from '../persistence/prisma/prisma.service';
import { InsufficientStockException } from '../../domain/exceptions/domain.exception';
import { StockEntryType } from '../../domain/value-objects/stock-entry-type.vo';

/**
 * These unit tests verify the adapter's orchestration: that it takes the row
 * lock before writing, delegates the invariants to the domain entity, and wraps
 * multi-part operations in a single transaction. The real all-or-nothing
 * rollback and the FOR UPDATE serialization are DB guarantees, exercised
 * against real Postgres in test/workshop-flow.e2e-spec.ts.
 */

interface StockRow {
  id: string;
  partId: string;
  branchId: string;
  stockFisico: number;
  stockReservado: number;
}

interface WorkOrderRow {
  branchId: string;
  parts: Array<{ partId: string; quantity: number }>;
}

function buildPrismaMock(opts: { stocks?: StockRow[]; workOrder?: WorkOrderRow | null }) {
  const stocks = opts.stocks ?? [];
  const ledger: Array<Record<string, unknown>> = [];

  const tx = {
    // Tagged-template call: (strings, partId, branchId) → the locked row(s).
    $queryRaw: jest.fn((_strings: TemplateStringsArray, partId: string, branchId: string) => {
      const row = stocks.find((s) => s.partId === partId && s.branchId === branchId);
      return Promise.resolve(
        row
          ? [{ id: row.id, stockFisico: row.stockFisico, stockReservado: row.stockReservado }]
          : [],
      );
    }),
    partBranchStock: {
      upsert: jest.fn(
        (args: {
          where: { partId_branchId: { partId: string; branchId: string } };
          create: { id: string };
        }) => {
          const { partId, branchId } = args.where.partId_branchId;
          let row = stocks.find((s) => s.partId === partId && s.branchId === branchId);
          if (!row) {
            row = { id: args.create.id, partId, branchId, stockFisico: 0, stockReservado: 0 };
            stocks.push(row);
          }
          return Promise.resolve(row);
        },
      ),
      update: jest.fn(
        (args: {
          where: { id: string };
          data: { stockFisico?: number; stockReservado?: number };
        }) => {
          const row = stocks.find((s) => s.id === args.where.id);
          if (row) {
            if (args.data.stockFisico !== undefined) row.stockFisico = args.data.stockFisico;
            if (args.data.stockReservado !== undefined)
              row.stockReservado = args.data.stockReservado;
          }
          return Promise.resolve(row);
        },
      ),
    },
    stockEntry: {
      create: jest.fn((args: { data: Record<string, unknown> }) => {
        ledger.push(args.data);
        return Promise.resolve(args.data);
      }),
    },
  };

  const prisma = {
    $transaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    workOrder: {
      findUnique: jest.fn(() => Promise.resolve(opts.workOrder ?? null)),
    },
  };

  return { prisma: prisma as unknown as PrismaService, tx, stocks, ledger };
}

describe('InventoryAdapter', () => {
  describe('reserveStock', () => {
    it('locks the row and persists the increased reservation in one transaction', async () => {
      const { prisma, tx, stocks } = buildPrismaMock({
        stocks: [{ id: 'st-1', partId: 'p1', branchId: 'b1', stockFisico: 10, stockReservado: 2 }],
      });
      const adapter = new InventoryAdapter(prisma);

      await adapter.reserveStock('p1', 'b1', 3);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.$queryRaw).toHaveBeenCalledTimes(1); // FOR UPDATE lock taken before the write
      expect(tx.partBranchStock.update).toHaveBeenCalledWith({
        where: { id: 'st-1' },
        data: { stockReservado: 5 },
      });
      expect(stocks[0].stockReservado).toBe(5);
    });

    it('throws InsufficientStockException and never writes when unavailable', async () => {
      const { prisma, tx, stocks } = buildPrismaMock({
        stocks: [{ id: 'st-1', partId: 'p1', branchId: 'b1', stockFisico: 5, stockReservado: 4 }],
      });
      const adapter = new InventoryAdapter(prisma);

      await expect(adapter.reserveStock('p1', 'b1', 3)).rejects.toBeInstanceOf(
        InsufficientStockException,
      );
      expect(tx.partBranchStock.update).not.toHaveBeenCalled();
      expect(stocks[0].stockReservado).toBe(4);
    });

    it('creates a zeroed row when none exists, then rejects reserving against empty stock', async () => {
      const { prisma, tx, stocks } = buildPrismaMock({ stocks: [] });
      const adapter = new InventoryAdapter(prisma);

      await expect(adapter.reserveStock('p1', 'b1', 1)).rejects.toBeInstanceOf(
        InsufficientStockException,
      );
      expect(tx.partBranchStock.upsert).toHaveBeenCalledTimes(1);
      expect(stocks).toHaveLength(1);
      expect(stocks[0].stockReservado).toBe(0);
    });
  });

  describe('confirmStockDiscount', () => {
    it('discounts every part and writes a SALIDA ledger entry inside a single transaction', async () => {
      const { prisma, tx, stocks, ledger } = buildPrismaMock({
        workOrder: {
          branchId: 'b1',
          parts: [
            { partId: 'p1', quantity: 2 },
            { partId: 'p2', quantity: 1 },
          ],
        },
        stocks: [
          { id: 'st-1', partId: 'p1', branchId: 'b1', stockFisico: 10, stockReservado: 2 },
          { id: 'st-2', partId: 'p2', branchId: 'b1', stockFisico: 5, stockReservado: 1 },
        ],
      });
      const adapter = new InventoryAdapter(prisma);

      await adapter.confirmStockDiscount('wo-1', 'tenant-1');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1); // whole loop is one transaction
      expect(stocks[0]).toMatchObject({ stockFisico: 8, stockReservado: 0 });
      expect(stocks[1]).toMatchObject({ stockFisico: 4, stockReservado: 0 });
      expect(tx.stockEntry.create).toHaveBeenCalledTimes(2);
      expect(ledger[0]).toMatchObject({
        tenantId: 'tenant-1',
        partId: 'p1',
        branchId: 'b1',
        type: StockEntryType.SALIDA,
        quantity: 2,
        referenceId: 'wo-1',
      });
    });

    it('skips parts that have no stock row', async () => {
      const { prisma, tx } = buildPrismaMock({
        workOrder: { branchId: 'b1', parts: [{ partId: 'ghost', quantity: 1 }] },
        stocks: [],
      });
      const adapter = new InventoryAdapter(prisma);

      await adapter.confirmStockDiscount('wo-1', 'tenant-1');

      expect(tx.partBranchStock.update).not.toHaveBeenCalled();
      expect(tx.stockEntry.create).not.toHaveBeenCalled();
    });

    it('aborts on a part with insufficient physical stock before writing later parts', async () => {
      const { prisma, tx, ledger } = buildPrismaMock({
        workOrder: {
          branchId: 'b1',
          parts: [
            { partId: 'p1', quantity: 2 },
            { partId: 'p2', quantity: 99 }, // exceeds physical stock → domain throws
          ],
        },
        stocks: [
          { id: 'st-1', partId: 'p1', branchId: 'b1', stockFisico: 10, stockReservado: 2 },
          { id: 'st-2', partId: 'p2', branchId: 'b1', stockFisico: 5, stockReservado: 1 },
        ],
      });
      const adapter = new InventoryAdapter(prisma);

      await expect(adapter.confirmStockDiscount('wo-1', 'tenant-1')).rejects.toMatchObject({
        code: 'INSUFFICIENT_PHYSICAL_STOCK',
      });
      // Threw at p2; only p1 was written before the throw. The real DB then rolls
      // back p1 too because it is the same transaction.
      expect(tx.stockEntry.create).toHaveBeenCalledTimes(1);
      expect(ledger.every((e) => e.partId !== 'p2')).toBe(true);
    });

    it('does nothing when the work order has no parts', async () => {
      const { prisma } = buildPrismaMock({ workOrder: { branchId: 'b1', parts: [] } });
      const adapter = new InventoryAdapter(prisma);

      await adapter.confirmStockDiscount('wo-1', 'tenant-1');

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('releaseAllReservations', () => {
    it('releases each part reservation within a single transaction', async () => {
      const { prisma, stocks } = buildPrismaMock({
        workOrder: {
          branchId: 'b1',
          parts: [
            { partId: 'p1', quantity: 2 },
            { partId: 'p2', quantity: 1 },
          ],
        },
        stocks: [
          { id: 'st-1', partId: 'p1', branchId: 'b1', stockFisico: 10, stockReservado: 2 },
          { id: 'st-2', partId: 'p2', branchId: 'b1', stockFisico: 5, stockReservado: 1 },
        ],
      });
      const adapter = new InventoryAdapter(prisma);

      await adapter.releaseAllReservations('wo-1');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(stocks[0].stockReservado).toBe(0);
      expect(stocks[1].stockReservado).toBe(0);
    });
  });

  describe('releaseReservation', () => {
    it('locks the row and reduces the reservation, floored at zero', async () => {
      const { prisma, stocks } = buildPrismaMock({
        stocks: [{ id: 'st-1', partId: 'p1', branchId: 'b1', stockFisico: 10, stockReservado: 2 }],
      });
      const adapter = new InventoryAdapter(prisma);

      await adapter.releaseReservation('p1', 'b1', 5);

      expect(stocks[0].stockReservado).toBe(0); // Math.max(0, 2 - 5)
    });
  });
});
