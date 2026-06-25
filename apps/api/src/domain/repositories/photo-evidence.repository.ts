import { PhotoPhase } from '../value-objects/photo-phase.vo';

export interface PhotoEvidenceRecord {
  id: string;
  workOrderId: string;
  r2Key: string;
  filename: string;
  sizeBytes: number;
  phase: PhotoPhase;
  description: string | null;
  uploadedBy: string;
  deletedAt: Date | null;
  createdAt: Date;
}

export interface PhotoEvidenceRepository {
  create(evidence: PhotoEvidenceRecord): Promise<void>;
  findById(id: string, workOrderId: string): Promise<PhotoEvidenceRecord | null>;
  findActiveByWorkOrder(workOrderId: string): Promise<PhotoEvidenceRecord[]>;
  countActiveByWorkOrder(workOrderId: string): Promise<number>;
  softDelete(id: string, workOrderId: string): Promise<void>;
}

export const PHOTO_EVIDENCE_REPOSITORY = Symbol('PhotoEvidenceRepository');
