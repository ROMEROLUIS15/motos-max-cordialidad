import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PartRepository, PART_REPOSITORY } from '../../../../domain/repositories/part.repository';

@Injectable()
export class DeactivatePartUseCase {
  constructor(@Inject(PART_REPOSITORY) private readonly partRepo: PartRepository) {}

  async execute(partId: string, tenantId: string): Promise<void> {
    const part = await this.partRepo.findById(partId, tenantId);
    if (!part) throw new NotFoundException('Repuesto no encontrado');
    part.deactivate();
    await this.partRepo.save(part);
  }
}
