import {
  Inject,
  Injectable,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
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
    if (unit.status === 'SOLD')
      throw new ConflictException('No se puede editar una motocicleta ya vendida');

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
