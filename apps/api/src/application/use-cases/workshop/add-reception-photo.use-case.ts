import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { MAX_RECEPTION_PHOTOS, ReceptionPhotoData } from '../../../domain/entities/vehicle-reception.entity';
import {
  VehicleReceptionRepository,
  VEHICLE_RECEPTION_REPOSITORY,
} from '../../../domain/repositories/vehicle-reception.repository';
import { StoragePort, STORAGE_PORT } from '../../ports/storage.port';
import { ImageProcessorService } from '../../../infrastructure/storage/image-processor.service';

export interface AddReceptionPhotoInput {
  tenantId: string;
  receptionId: string;
  buffer: Buffer;
  mimeType: string;
  originalName: string;
}

@Injectable()
export class AddReceptionPhotoUseCase {
  constructor(
    @Inject(VEHICLE_RECEPTION_REPOSITORY)
    private readonly receptionRepo: VehicleReceptionRepository,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly imageProcessor: ImageProcessorService,
  ) {}

  async execute(input: AddReceptionPhotoInput): Promise<ReceptionPhotoData> {
    const reception = await this.receptionRepo.findById(input.receptionId, input.tenantId);
    if (!reception) throw new NotFoundException('Recepción no encontrada');

    const count = await this.receptionRepo.countPhotos(input.receptionId);
    if (count >= MAX_RECEPTION_PHOTOS) {
      throw new UnprocessableEntityException(
        `Máximo ${MAX_RECEPTION_PHOTOS} fotos por recepción`,
      );
    }

    const processed = await this.imageProcessor.process(input.buffer, input.mimeType);
    const photoId = randomUUID();
    const filename = `${photoId}.${processed.extension}`;
    const r2Key = `${reception.tenantId}/${reception.branchId}/receptions/${reception.id}/photos/${filename}`;

    await this.storage.upload(r2Key, processed.buffer, processed.contentType);

    const photo: ReceptionPhotoData = {
      id: photoId,
      receptionId: reception.id,
      r2Key,
      filename,
      sizeBytes: processed.buffer.length,
      createdAt: new Date(),
    };
    await this.receptionRepo.addPhoto(reception.id, photo);
    return photo;
  }
}
