import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MotorcycleUnit } from '../../../../domain/entities/motorcycle-unit.entity';
import {
  MotorcycleUnitRepository,
  MOTORCYCLE_UNIT_REPOSITORY,
} from '../../../../domain/repositories/motorcycle-unit.repository';

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
