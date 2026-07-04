import { IsIn } from 'class-validator';
import { MotorcycleStatus } from '../../../domain/entities/motorcycle-unit.entity';

export class SetMotorcycleUnitStatusDto {
  @IsIn(['AVAILABLE', 'RESERVED', 'SOLD'])
  status!: MotorcycleStatus;
}
