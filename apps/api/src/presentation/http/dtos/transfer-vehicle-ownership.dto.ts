import { IsString } from 'class-validator';

export class TransferVehicleOwnershipDto {
  @IsString()
  newOwnerId!: string;
}
