import {
  Inject,
  Injectable,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  MotorcycleUnit,
  MotorcycleCondition,
  MotorcycleStatus,
} from '../../../domain/entities/motorcycle-unit.entity';
import {
  MotorcycleUnitRepository,
  MOTORCYCLE_UNIT_REPOSITORY,
  MotorcycleUnitSearchFilters,
} from '../../../domain/repositories/motorcycle-unit.repository';
import { Pagination, PaginatedResult } from '../../../domain/shared/pagination';

export interface RegisterMotorcycleUnitInput {
  tenantId: string;
  branchId: string;
  vin: string;
  brand: string;
  model: string;
  year: number;
  displacement?: number | null;
  color?: string | null;
  condition: MotorcycleCondition;
  mileage?: number;
  engineNumber?: string | null;
  plate?: string | null;
  costPrice: number;
  salePrice: number;
  description?: string | null;
  imageUrl?: string | null;
}

function domainError<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    throw new UnprocessableEntityException((e as Error).message);
  }
}

@Injectable()
export class RegisterMotorcycleUnitUseCase {
  constructor(
    @Inject(MOTORCYCLE_UNIT_REPOSITORY) private readonly repo: MotorcycleUnitRepository,
  ) {}

  async execute(input: RegisterMotorcycleUnitInput): Promise<MotorcycleUnit> {
    const existing = await this.repo.findByVin(input.vin, input.tenantId);
    if (existing) throw new ConflictException(`El VIN ${input.vin} ya existe en este tenant`);

    const now = new Date();
    const unit = domainError(
      () =>
        new MotorcycleUnit(
          randomUUID(),
          input.tenantId,
          input.branchId,
          input.vin,
          input.brand,
          input.model,
          input.year,
          input.displacement ?? null,
          input.color ?? null,
          input.condition ?? 'NEW',
          input.mileage ?? 0,
          input.engineNumber ?? null,
          input.plate ?? null,
          input.costPrice,
          input.salePrice,
          'AVAILABLE',
          input.description ?? null,
          input.imageUrl ?? null,
          now,
          now,
        ),
    );
    await this.repo.create(unit);
    return unit;
  }
}

export interface UpdateMotorcycleUnitInput {
  tenantId: string;
  unitId: string;
  branchId?: string;
  brand?: string;
  model?: string;
  year?: number;
  displacement?: number | null;
  color?: string | null;
  condition?: MotorcycleCondition;
  mileage?: number;
  engineNumber?: string | null;
  plate?: string | null;
  costPrice?: number;
  salePrice?: number;
  description?: string | null;
  imageUrl?: string | null;
}

@Injectable()
export class UpdateMotorcycleUnitUseCase {
  constructor(
    @Inject(MOTORCYCLE_UNIT_REPOSITORY) private readonly repo: MotorcycleUnitRepository,
  ) {}

  async execute(input: UpdateMotorcycleUnitInput): Promise<void> {
    const unit = await this.repo.findById(input.unitId, input.tenantId);
    if (!unit) throw new NotFoundException('Motocicleta no encontrada');
    if (unit.status === 'SOLD') {
      throw new ConflictException('No se puede editar una motocicleta ya vendida');
    }

    if (input.branchId !== undefined) unit.branchId = input.branchId;
    if (input.brand !== undefined) unit.brand = input.brand;
    if (input.model !== undefined) unit.model = input.model;
    if (input.year !== undefined) unit.year = input.year;
    if (input.displacement !== undefined) unit.displacement = input.displacement;
    if (input.color !== undefined) unit.color = input.color;
    if (input.condition !== undefined) unit.condition = input.condition;
    if (input.mileage !== undefined) unit.mileage = input.mileage;
    if (input.engineNumber !== undefined) unit.engineNumber = input.engineNumber;
    if (input.plate !== undefined) unit.plate = input.plate;
    if (input.description !== undefined) unit.description = input.description;
    if (input.imageUrl !== undefined) unit.imageUrl = input.imageUrl;
    if (input.costPrice !== undefined || input.salePrice !== undefined) {
      domainError(() =>
        unit.updatePrices(input.costPrice ?? unit.costPrice, input.salePrice ?? unit.salePrice),
      );
    } else {
      unit.updatedAt = new Date();
    }
    // Re-validate invariants (year/mileage/condition) by reconstructing.
    domainError(
      () =>
        new MotorcycleUnit(
          unit.id,
          unit.tenantId,
          unit.branchId,
          unit.vin,
          unit.brand,
          unit.model,
          unit.year,
          unit.displacement,
          unit.color,
          unit.condition,
          unit.mileage,
          unit.engineNumber,
          unit.plate,
          unit.costPrice,
          unit.salePrice,
          unit.status,
          unit.description,
          unit.imageUrl,
          unit.createdAt,
          unit.updatedAt,
        ),
    );
    await this.repo.save(unit);
  }
}

@Injectable()
export class ChangeMotorcycleUnitStatusUseCase {
  constructor(
    @Inject(MOTORCYCLE_UNIT_REPOSITORY) private readonly repo: MotorcycleUnitRepository,
  ) {}

  async execute(unitId: string, tenantId: string, next: MotorcycleStatus): Promise<void> {
    const unit = await this.repo.findById(unitId, tenantId);
    if (!unit) throw new NotFoundException('Motocicleta no encontrada');
    domainError(() => unit.changeStatus(next));
    await this.repo.save(unit);
  }
}

export interface SearchMotorcycleUnitsInput extends MotorcycleUnitSearchFilters {
  tenantId: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class SearchMotorcycleUnitsUseCase {
  constructor(
    @Inject(MOTORCYCLE_UNIT_REPOSITORY) private readonly repo: MotorcycleUnitRepository,
  ) {}

  async execute(input: SearchMotorcycleUnitsInput): Promise<PaginatedResult<MotorcycleUnit>> {
    const pagination: Pagination = { page: input.page ?? 1, pageSize: input.pageSize ?? 20 };
    return this.repo.search(
      {
        query: input.query,
        status: input.status,
        condition: input.condition,
        branchId: input.branchId,
      },
      input.tenantId,
      pagination,
    );
  }
}

@Injectable()
export class GetMotorcycleUnitDetailUseCase {
  constructor(
    @Inject(MOTORCYCLE_UNIT_REPOSITORY) private readonly repo: MotorcycleUnitRepository,
  ) {}

  async execute(unitId: string, tenantId: string): Promise<MotorcycleUnit> {
    const unit = await this.repo.findById(unitId, tenantId);
    if (!unit) throw new NotFoundException('Motocicleta no encontrada');
    return unit;
  }
}
