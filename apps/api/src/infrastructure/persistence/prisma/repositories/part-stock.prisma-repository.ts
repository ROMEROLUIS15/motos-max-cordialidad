import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service';
import {
  PartStockRepository,
  TransferStockInput,
  LowStockItem,
} from '../../../../domain/repositories/part-stock.repository';
import { PartBranchStock } from '../../../../domain/entities/part-branch-stock.entity';
import { InsufficientStockException } from '../../../../domain/exceptions/domain.exception';
import { StockEntryType } from '../../../../domain/value-objects/stock-entry-type.vo';

@Injectable()
export class PartStockPrismaRepository implements PartStockRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByPartAndBranch(partId: string, branchId: string): Promise<PartBranchStock | null> {
    const r = await this.prisma.partBranchStock.findUnique({
      where: { partId_branchId: { partId, branchId } },
    });
    if (!r) return null;
    return new PartBranchStock(r.id, r.partId, r.branchId, Number(r.stockFisico), Number(r.stockReservado));
  }

  async save(stock: PartBranchStock): Promise<void> {
    await this.prisma.partBranchStock.update({
      where: { id: stock.id },
      data: { stockFisico: stock.stockFisico, stockReservado: stock.stockReservado },
    });
  }

  async ensureExists(partId: string, branchId: string): Promise<PartBranchStock> {
    const r = await this.prisma.partBranchStock.upsert({
      where: { partId_branchId: { partId, branchId } },
      update: {},
      create: { id: randomUUID(), partId, branchId, stockFisico: 0, stockReservado: 0 },
    });
    return new PartBranchStock(r.id, r.partId, r.branchId, Number(r.stockFisico), Number(r.stockReservado));
  }

  async transferAtomically(input: TransferStockInput): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const source = await tx.partBranchStock.findUnique({
        where: { partId_branchId: { partId: input.partId, branchId: input.fromBranchId } },
      });
      const available = source ? Number(source.stockFisico) - Number(source.stockReservado) : 0;
      if (!source || available < input.quantity) {
        throw new InsufficientStockException(input.partId, input.quantity, available);
      }

      await tx.partBranchStock.update({
        where: { id: source.id },
        data: { stockFisico: { decrement: input.quantity } },
      });

      await tx.partBranchStock.upsert({
        where: { partId_branchId: { partId: input.partId, branchId: input.toBranchId } },
        update: { stockFisico: { increment: input.quantity } },
        create: {
          id: randomUUID(),
          partId: input.partId,
          branchId: input.toBranchId,
          stockFisico: input.quantity,
          stockReservado: 0,
        },
      });

      const transferRef = randomUUID();
      await tx.stockEntry.createMany({
        data: [
          {
            id: randomUUID(), tenantId: input.tenantId, partId: input.partId,
            branchId: input.fromBranchId, type: StockEntryType.TRANSFER_OUT,
            quantity: input.quantity, userId: input.userId, referenceId: transferRef,
            notes: input.notes ?? null,
          },
          {
            id: randomUUID(), tenantId: input.tenantId, partId: input.partId,
            branchId: input.toBranchId, type: StockEntryType.TRANSFER_IN,
            quantity: input.quantity, userId: input.userId, referenceId: transferRef,
            notes: input.notes ?? null,
          },
        ],
      });
    });
  }

  async findLowStock(branchId: string, tenantId: string): Promise<LowStockItem[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        partId: string;
        sku: string;
        name: string;
        branchId: string;
        stockDisponible: Prisma.Decimal;
        minStockAlert: Prisma.Decimal;
      }>
    >`
      SELECT pbs."partId" AS "partId", p."sku" AS "sku", p."name" AS "name",
             pbs."branchId" AS "branchId",
             (pbs."stockFisico" - pbs."stockReservado") AS "stockDisponible",
             p."minStockAlert" AS "minStockAlert"
      FROM "part_branch_stocks" pbs
      JOIN "parts" p ON p."id" = pbs."partId"
      WHERE p."tenantId" = ${tenantId}
        AND pbs."branchId" = ${branchId}
        AND p."minStockAlert" IS NOT NULL
        AND (pbs."stockFisico" - pbs."stockReservado") < p."minStockAlert"
    `;
    return rows.map((r) => ({
      partId: r.partId,
      sku: r.sku,
      name: r.name,
      branchId: r.branchId,
      stockDisponible: Number(r.stockDisponible),
      minStockAlert: Number(r.minStockAlert),
    }));
  }

  async valuation(branchId: string, tenantId: string): Promise<{ totalCost: number; totalSale: number }> {
    const rows = await this.prisma.$queryRaw<Array<{ totalCost: Prisma.Decimal | null; totalSale: Prisma.Decimal | null }>>`
      SELECT COALESCE(SUM(pbs."stockFisico" * p."costPrice"), 0) AS "totalCost",
             COALESCE(SUM(pbs."stockFisico" * p."salePrice"), 0) AS "totalSale"
      FROM "part_branch_stocks" pbs
      JOIN "parts" p ON p."id" = pbs."partId"
      WHERE p."tenantId" = ${tenantId} AND pbs."branchId" = ${branchId}
    `;
    return { totalCost: Number(rows[0]?.totalCost ?? 0), totalSale: Number(rows[0]?.totalSale ?? 0) };
  }
}
