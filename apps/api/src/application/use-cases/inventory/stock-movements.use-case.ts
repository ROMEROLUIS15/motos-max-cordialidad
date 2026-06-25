import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  PartStockRepository,
  PART_STOCK_REPOSITORY,
  TransferStockInput,
  LowStockItem,
} from '../../../domain/repositories/part-stock.repository';
import {
  StockEntryRepository,
  STOCK_ENTRY_REPOSITORY,
  StockEntryRecord,
  StockHistoryFilters,
} from '../../../domain/repositories/stock-entry.repository';
import { StockEntryType } from '../../../domain/value-objects/stock-entry-type.vo';
import { Pagination, PaginatedResult } from '../../../domain/shared/pagination';

interface MovementBase {
  tenantId: string;
  partId: string;
  branchId: string;
  quantity: number;
  userId: string;
  notes?: string;
}

@Injectable()
export class RegisterStockEntryUseCase {
  constructor(
    @Inject(PART_STOCK_REPOSITORY) private readonly stockRepo: PartStockRepository,
    @Inject(STOCK_ENTRY_REPOSITORY) private readonly entryRepo: StockEntryRepository,
  ) {}

  async execute(input: MovementBase): Promise<void> {
    const stock = await this.stockRepo.ensureExists(input.partId, input.branchId);
    stock.addStock(input.quantity);
    await this.stockRepo.save(stock);
    await this.entryRepo.create(this.entry(input, StockEntryType.ENTRADA, input.quantity));
  }

  private entry(input: MovementBase, type: StockEntryType, quantity: number): StockEntryRecord {
    return {
      id: randomUUID(), tenantId: input.tenantId, partId: input.partId, branchId: input.branchId,
      type, quantity, userId: input.userId, referenceId: null, notes: input.notes ?? null,
      createdAt: new Date(),
    };
  }
}

@Injectable()
export class RegisterStockExitUseCase {
  constructor(
    @Inject(PART_STOCK_REPOSITORY) private readonly stockRepo: PartStockRepository,
    @Inject(STOCK_ENTRY_REPOSITORY) private readonly entryRepo: StockEntryRepository,
  ) {}

  async execute(input: MovementBase): Promise<void> {
    const stock = await this.stockRepo.findByPartAndBranch(input.partId, input.branchId);
    if (!stock) throw new NotFoundException('No hay stock registrado para este repuesto en la sucursal');
    stock.removeStock(input.quantity); // throws InsufficientStockException if not enough available
    await this.stockRepo.save(stock);
    await this.entryRepo.create({
      id: randomUUID(), tenantId: input.tenantId, partId: input.partId, branchId: input.branchId,
      type: StockEntryType.SALIDA, quantity: input.quantity, userId: input.userId,
      referenceId: null, notes: input.notes ?? null, createdAt: new Date(),
    });
  }
}

export interface AdjustInventoryInput {
  tenantId: string;
  partId: string;
  branchId: string;
  newPhysicalCount: number;
  userId: string;
  notes: string;
}

@Injectable()
export class AdjustInventoryUseCase {
  constructor(
    @Inject(PART_STOCK_REPOSITORY) private readonly stockRepo: PartStockRepository,
    @Inject(STOCK_ENTRY_REPOSITORY) private readonly entryRepo: StockEntryRepository,
  ) {}

  async execute(input: AdjustInventoryInput): Promise<{ difference: number }> {
    if (!input.notes || input.notes.trim().length === 0) {
      throw new UnprocessableEntityException('La justificación (notes) es obligatoria para un ajuste');
    }
    const stock = await this.stockRepo.ensureExists(input.partId, input.branchId);
    const difference = stock.adjust(input.newPhysicalCount);
    await this.stockRepo.save(stock);
    await this.entryRepo.create({
      id: randomUUID(), tenantId: input.tenantId, partId: input.partId, branchId: input.branchId,
      type: StockEntryType.AJUSTE, quantity: difference, userId: input.userId,
      referenceId: null, notes: input.notes, createdAt: new Date(),
    });
    return { difference };
  }
}

@Injectable()
export class TransferStockBetweenBranchesUseCase {
  constructor(
    @Inject(PART_STOCK_REPOSITORY) private readonly stockRepo: PartStockRepository,
  ) {}

  async execute(input: TransferStockInput): Promise<void> {
    if (input.fromBranchId === input.toBranchId) {
      throw new UnprocessableEntityException('La sucursal origen y destino no pueden ser la misma');
    }
    // The Prisma transaction lives in the repository.
    await this.stockRepo.transferAtomically(input);
  }
}

export interface GetStockHistoryInput extends StockHistoryFilters {
  tenantId: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class GetStockHistoryUseCase {
  constructor(
    @Inject(STOCK_ENTRY_REPOSITORY) private readonly entryRepo: StockEntryRepository,
  ) {}

  async execute(input: GetStockHistoryInput): Promise<PaginatedResult<StockEntryRecord>> {
    const pagination: Pagination = { page: input.page ?? 1, pageSize: input.pageSize ?? 20 };
    return this.entryRepo.history(
      { partId: input.partId, branchId: input.branchId, from: input.from, to: input.to },
      input.tenantId,
      pagination,
    );
  }
}

@Injectable()
export class GetLowStockUseCase {
  constructor(
    @Inject(PART_STOCK_REPOSITORY) private readonly stockRepo: PartStockRepository,
  ) {}

  async execute(branchId: string, tenantId: string): Promise<LowStockItem[]> {
    return this.stockRepo.findLowStock(branchId, tenantId);
  }
}

@Injectable()
export class GetStockValuationUseCase {
  constructor(
    @Inject(PART_STOCK_REPOSITORY) private readonly stockRepo: PartStockRepository,
  ) {}

  async execute(branchId: string, tenantId: string): Promise<{ totalCost: number; totalSale: number }> {
    return this.stockRepo.valuation(branchId, tenantId);
  }
}
