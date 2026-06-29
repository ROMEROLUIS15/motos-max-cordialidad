import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MotorcycleStatus } from '../../../../domain/entities/motorcycle-unit.entity';
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
