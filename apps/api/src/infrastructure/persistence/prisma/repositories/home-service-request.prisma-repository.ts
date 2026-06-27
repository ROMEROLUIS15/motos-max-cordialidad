import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import {
  HomeServiceRequestRepository,
  HomeServiceRequestRecord,
  HomeServiceFilters,
  HomeServiceUpdate,
} from '../../../../domain/repositories/home-service-request.repository';
import {
  Pagination,
  PaginatedResult,
  paginationToSkipTake,
} from '../../../../domain/shared/pagination';

type Row = {
  id: string;
  tenantId: string;
  branchId: string | null;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  address: string;
  problemDesc: string;
  serviceType: string;
  status: string;
  assignedTo: string | null;
  workOrderId: string | null;
  estimatedCost: Prisma.Decimal | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class HomeServiceRequestPrismaRepository implements HomeServiceRequestRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(record: HomeServiceRequestRecord): Promise<void> {
    await this.prisma.homeServiceRequest.create({
      data: {
        id: record.id,
        tenantId: record.tenantId,
        branchId: record.branchId,
        customerId: record.customerId,
        customerName: record.customerName,
        customerPhone: record.customerPhone,
        address: record.address,
        problemDesc: record.problemDesc,
        serviceType: record.serviceType,
        status: record.status,
        assignedTo: record.assignedTo,
        workOrderId: record.workOrderId,
        estimatedCost: record.estimatedCost,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
    });
  }

  async findById(id: string, tenantId: string): Promise<HomeServiceRequestRecord | null> {
    const r = await this.prisma.homeServiceRequest.findFirst({ where: { id, tenantId } });
    return r ? this.toRecord(r) : null;
  }

  async list(
    tenantId: string,
    filters: HomeServiceFilters,
    pagination: Pagination,
  ): Promise<PaginatedResult<HomeServiceRequestRecord>> {
    const where: Prisma.HomeServiceRequestWhereInput = { tenantId };
    if (filters.status) where.status = filters.status;
    const { skip, take } = paginationToSkipTake(pagination);
    const [rows, total] = await Promise.all([
      this.prisma.homeServiceRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.homeServiceRequest.count({ where }),
    ]);
    return {
      items: rows.map((r) => this.toRecord(r)),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
    };
  }

  async update(
    id: string,
    tenantId: string,
    patch: HomeServiceUpdate,
  ): Promise<HomeServiceRequestRecord | null> {
    const existing = await this.prisma.homeServiceRequest.findFirst({ where: { id, tenantId } });
    if (!existing) return null;
    const r = await this.prisma.homeServiceRequest.update({
      where: { id },
      data: {
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.assignedTo !== undefined ? { assignedTo: patch.assignedTo } : {}),
      },
    });
    return this.toRecord(r);
  }

  private toRecord(r: Row): HomeServiceRequestRecord {
    return {
      id: r.id,
      tenantId: r.tenantId,
      branchId: r.branchId,
      customerId: r.customerId,
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      address: r.address,
      problemDesc: r.problemDesc,
      serviceType: r.serviceType,
      status: r.status,
      assignedTo: r.assignedTo,
      workOrderId: r.workOrderId,
      estimatedCost: r.estimatedCost === null ? null : Number(r.estimatedCost),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
