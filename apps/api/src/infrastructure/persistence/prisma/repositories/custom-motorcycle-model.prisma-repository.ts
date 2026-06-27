import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  CustomMotorcycleModel,
  CustomMotorcycleModelRepository,
} from '../../../../domain/repositories/custom-motorcycle-model.repository';

@Injectable()
export class CustomMotorcycleModelPrismaRepository implements CustomMotorcycleModelRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByTenant(tenantId: string): Promise<CustomMotorcycleModel[]> {
    return this.prisma.customMotorcycleModel.findMany({
      where: { tenantId },
      orderBy: [{ brand: 'asc' }, { model: 'asc' }],
    });
  }

  async create(model: Omit<CustomMotorcycleModel, 'id'>): Promise<CustomMotorcycleModel> {
    return this.prisma.customMotorcycleModel.create({ data: model });
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.prisma.customMotorcycleModel.deleteMany({ where: { id, tenantId } });
  }
}
