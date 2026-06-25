import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  PhotoEvidenceRepository,
  PhotoEvidenceRecord,
} from '../../../../domain/repositories/photo-evidence.repository';
import { PhotoPhase } from '../../../../domain/value-objects/photo-phase.vo';

@Injectable()
export class PhotoEvidencePrismaRepository implements PhotoEvidenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(evidence: PhotoEvidenceRecord): Promise<void> {
    await this.prisma.photoEvidence.create({
      data: {
        id: evidence.id,
        workOrderId: evidence.workOrderId,
        r2Key: evidence.r2Key,
        filename: evidence.filename,
        sizeBytes: evidence.sizeBytes,
        phase: evidence.phase,
        description: evidence.description,
        uploadedBy: evidence.uploadedBy,
        deletedAt: evidence.deletedAt,
        createdAt: evidence.createdAt,
      },
    });
  }

  private toRecord(p: {
    id: string;
    workOrderId: string;
    r2Key: string;
    filename: string;
    sizeBytes: number;
    phase: string;
    description: string | null;
    uploadedBy: string;
    deletedAt: Date | null;
    createdAt: Date;
  }): PhotoEvidenceRecord {
    return { ...p, phase: p.phase as PhotoPhase };
  }

  async findById(id: string, workOrderId: string): Promise<PhotoEvidenceRecord | null> {
    const p = await this.prisma.photoEvidence.findFirst({ where: { id, workOrderId } });
    return p ? this.toRecord(p) : null;
  }

  async findActiveByWorkOrder(workOrderId: string): Promise<PhotoEvidenceRecord[]> {
    const rows = await this.prisma.photoEvidence.findMany({
      where: { workOrderId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toRecord(r));
  }

  async countActiveByWorkOrder(workOrderId: string): Promise<number> {
    return this.prisma.photoEvidence.count({ where: { workOrderId, deletedAt: null } });
  }

  async softDelete(id: string, workOrderId: string): Promise<void> {
    await this.prisma.photoEvidence.updateMany({
      where: { id, workOrderId },
      data: { deletedAt: new Date() },
    });
  }
}
