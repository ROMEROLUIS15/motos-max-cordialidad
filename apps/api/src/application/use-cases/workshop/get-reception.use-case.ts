import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  VehicleReceptionRepository,
  VEHICLE_RECEPTION_REPOSITORY,
} from '../../../domain/repositories/vehicle-reception.repository';
import { StoragePort, STORAGE_PORT } from '../../ports/storage.port';

const SIGNED_URL_TTL = 86400; // 24h

@Injectable()
export class GetReceptionUseCase {
  constructor(
    @Inject(VEHICLE_RECEPTION_REPOSITORY)
    private readonly receptionRepo: VehicleReceptionRepository,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  async execute(receptionId: string, tenantId: string) {
    const reception = await this.receptionRepo.findById(receptionId, tenantId);
    if (!reception) throw new NotFoundException('Recepción no encontrada');

    const photos = await Promise.all(
      reception.photos.map(async (p) => ({
        id: p.id,
        filename: p.filename,
        sizeBytes: p.sizeBytes,
        url: await this.storage.getSignedUrl(p.r2Key, SIGNED_URL_TTL),
      })),
    );

    return { ...reception, photos };
  }
}

@Injectable()
export class DeleteReceptionPhotoUseCase {
  constructor(
    @Inject(VEHICLE_RECEPTION_REPOSITORY)
    private readonly receptionRepo: VehicleReceptionRepository,
  ) {}

  async execute(receptionId: string, photoId: string, tenantId: string): Promise<void> {
    const reception = await this.receptionRepo.findById(receptionId, tenantId);
    if (!reception) throw new NotFoundException('Recepción no encontrada');
    await this.receptionRepo.deletePhoto(receptionId, photoId);
  }
}
