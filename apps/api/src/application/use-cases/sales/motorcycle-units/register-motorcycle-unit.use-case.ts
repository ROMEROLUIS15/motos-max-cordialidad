import {
  Inject,
  Injectable,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  MotorcycleUnit,
  MotorcycleCondition,
} from '../../../../domain/entities/motorcycle-unit.entity';
import {
  MotorcycleUnitRepository,
  MOTORCYCLE_UNIT_REPOSITORY,
} from '../../../../domain/repositories/motorcycle-unit.repository';

function domainError<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    throw new UnprocessableEntityException((e as Error).message);
  }
}

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
