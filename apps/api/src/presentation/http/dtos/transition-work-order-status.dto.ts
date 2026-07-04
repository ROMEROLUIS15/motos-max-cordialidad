import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { WorkOrderStatus } from '../../../domain/value-objects/work-order-status.vo';

export class TransitionWorkOrderStatusDto {
  @IsEnum(WorkOrderStatus)
  newStatus!: WorkOrderStatus;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  finalOdometer?: number;
}
