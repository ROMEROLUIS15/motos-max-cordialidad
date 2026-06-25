import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PhotoPhase, isPhotoPhase } from '../../../domain/value-objects/photo-phase.vo';
import { WorkOrderStatus } from '../../../domain/value-objects/work-order-status.vo';
import {
  PhotoEvidenceRepository,
  PHOTO_EVIDENCE_REPOSITORY,
  PhotoEvidenceRecord,
} from '../../../domain/repositories/photo-evidence.repository';
import {
  WorkOrderRepository,
  WORK_ORDER_REPOSITORY,
} from '../../../domain/repositories/work-order.repository';
import { StoragePort, STORAGE_PORT } from '../../ports/storage.port';
import { ImageProcessorService } from '../../../infrastructure/storage/image-processor.service';

const MAX_EVIDENCES = 20;
const MAX_BYTES = 10 * 1024 * 1024;
const SIGNED_URL_TTL = 86400; // 24h

export interface UploadPhotoEvidenceInput {
  tenantId: string;
  workOrderId: string;
  buffer: Buffer;
  mimeType: string;
  phase: string;
  uploadedBy: string;
  description?: string;
}

@Injectable()
export class UploadPhotoEvidenceUseCase {
  constructor(
    @Inject(PHOTO_EVIDENCE_REPOSITORY) private readonly evidenceRepo: PhotoEvidenceRepository,
    @Inject(WORK_ORDER_REPOSITORY) private readonly workOrderRepo: WorkOrderRepository,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly imageProcessor: ImageProcessorService,
  ) {}

  async execute(input: UploadPhotoEvidenceInput): Promise<PhotoEvidenceRecord> {
    if (!isPhotoPhase(input.phase)) {
      throw new UnprocessableEntityException(
        `Fase inválida. Valores: ${Object.values(PhotoPhase).join(', ')}`,
      );
    }
    if (input.buffer.length > MAX_BYTES) {
      throw new UnprocessableEntityException('La imagen supera el tamaño máximo de 10MB');
    }

    const workOrder = await this.workOrderRepo.findById(input.workOrderId, input.tenantId);
    if (!workOrder) throw new NotFoundException('Orden de trabajo no encontrada');
    if (workOrder.status === WorkOrderStatus.CANCELLED) {
      throw new UnprocessableEntityException(
        'No se pueden agregar evidencias a una orden cancelada',
      );
    }

    const count = await this.evidenceRepo.countActiveByWorkOrder(input.workOrderId);
    if (count >= MAX_EVIDENCES) {
      throw new UnprocessableEntityException(`Máximo ${MAX_EVIDENCES} fotos por orden de trabajo`);
    }

    const processed = await this.imageProcessor.process(input.buffer, input.mimeType);
    const photoId = randomUUID();
    const filename = `${photoId}.${processed.extension}`;
    const r2Key = `${workOrder.tenantId}/${workOrder.branchId}/work-orders/${workOrder.id}/evidences/${filename}`;

    await this.storage.upload(r2Key, processed.buffer, processed.contentType);

    const record: PhotoEvidenceRecord = {
      id: photoId,
      workOrderId: workOrder.id,
      r2Key,
      filename,
      sizeBytes: processed.buffer.length,
      phase: input.phase,
      description: input.description ?? null,
      uploadedBy: input.uploadedBy,
      deletedAt: null,
      createdAt: new Date(),
    };
    await this.evidenceRepo.create(record);
    return record;
  }
}

@Injectable()
export class DeletePhotoEvidenceUseCase {
  constructor(
    @Inject(PHOTO_EVIDENCE_REPOSITORY) private readonly evidenceRepo: PhotoEvidenceRepository,
    @Inject(WORK_ORDER_REPOSITORY) private readonly workOrderRepo: WorkOrderRepository,
  ) {}

  async execute(workOrderId: string, evidenceId: string, tenantId: string): Promise<void> {
    const workOrder = await this.workOrderRepo.findById(workOrderId, tenantId);
    if (!workOrder) throw new NotFoundException('Orden de trabajo no encontrada');
    if (workOrder.status === WorkOrderStatus.DELIVERED) {
      throw new UnprocessableEntityException(
        'No se pueden eliminar evidencias de una orden entregada',
      );
    }
    const evidence = await this.evidenceRepo.findById(evidenceId, workOrderId);
    if (!evidence) throw new NotFoundException('Evidencia no encontrada');
    // Soft delete only — the R2 object is intentionally NOT removed.
    await this.evidenceRepo.softDelete(evidenceId, workOrderId);
  }
}

@Injectable()
export class GetPhotoEvidenceUrlsUseCase {
  constructor(
    @Inject(PHOTO_EVIDENCE_REPOSITORY) private readonly evidenceRepo: PhotoEvidenceRepository,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  async execute(workOrderId: string) {
    const evidences = await this.evidenceRepo.findActiveByWorkOrder(workOrderId);
    return Promise.all(
      evidences.map(async (e) => ({
        id: e.id,
        phase: e.phase,
        description: e.description,
        filename: e.filename,
        url: await this.storage.getSignedUrl(e.r2Key, SIGNED_URL_TTL),
        createdAt: e.createdAt,
      })),
    );
  }
}
