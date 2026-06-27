import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  HomeServiceRequestRepository,
  HOME_SERVICE_REQUEST_REPOSITORY,
  HomeServiceRequestRecord,
} from '../../../domain/repositories/home-service-request.repository';
import { UserRepository, USER_REPOSITORY } from '../../../domain/repositories/user.repository';
import { NotificationPort, NOTIFICATION_PORT } from '../../ports/notification.port';
import { MessagingPort, MESSAGING_PORT } from '../../ports/messaging.port';
import { Pagination } from '../../../domain/shared/pagination';
import { DomainException } from '../../../domain/exceptions/domain.exception';

export const HOME_SERVICE_STATUSES = [
  'PENDING',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const;

export interface CreateHomeServiceInput {
  tenantId: string;
  branchId?: string | null;
  customerId?: string | null;
  customerName: string;
  customerPhone: string;
  address: string;
  problemDesc: string;
  serviceType: string;
}

@Injectable()
export class CreateHomeServiceRequestUseCase {
  private readonly logger = new Logger(CreateHomeServiceRequestUseCase.name);

  constructor(
    @Inject(HOME_SERVICE_REQUEST_REPOSITORY)
    private readonly repo: HomeServiceRequestRepository,
    @Inject(NOTIFICATION_PORT) private readonly notifications: NotificationPort,
    @Inject(MESSAGING_PORT) private readonly messaging: MessagingPort,
  ) {}

  async execute(input: CreateHomeServiceInput): Promise<{ id: string; status: string }> {
    const now = new Date();
    const record: HomeServiceRequestRecord = {
      id: randomUUID(),
      tenantId: input.tenantId,
      branchId: input.branchId ?? null,
      customerId: input.customerId ?? null,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      address: input.address,
      problemDesc: input.problemDesc,
      serviceType: input.serviceType,
      status: 'PENDING',
      assignedTo: null,
      workOrderId: null,
      estimatedCost: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.repo.create(record);

    // Notify the workshop (in-app + WhatsApp). Best-effort: a messaging failure
    // must not roll back the captured request.
    try {
      await this.notifications.notifyAdmins(input.tenantId, {
        type: 'HOME_SERVICE_REQUEST',
        resourceId: record.id,
      });
      await this.messaging.sendOwnerMessage(
        input.tenantId,
        `🛠️ Nueva solicitud de servicio a domicilio de ${input.customerName} (${input.customerPhone}).\n` +
          `Dirección: ${input.address}\nProblema: ${input.problemDesc}`,
      );
    } catch (err) {
      this.logger.warn(`Home-service notifications failed for ${record.id}: ${String(err)}`);
    }

    return { id: record.id, status: record.status };
  }
}

@Injectable()
export class ListHomeServiceRequestsUseCase {
  constructor(
    @Inject(HOME_SERVICE_REQUEST_REPOSITORY)
    private readonly repo: HomeServiceRequestRepository,
  ) {}

  async execute(tenantId: string, status: string | undefined, pagination: Pagination) {
    return this.repo.list(tenantId, { status }, pagination);
  }
}

@Injectable()
export class AssignHomeServiceRequestUseCase {
  private readonly logger = new Logger(AssignHomeServiceRequestUseCase.name);

  constructor(
    @Inject(HOME_SERVICE_REQUEST_REPOSITORY)
    private readonly repo: HomeServiceRequestRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(MESSAGING_PORT) private readonly messaging: MessagingPort,
  ) {}

  async execute(id: string, tenantId: string, assignedTo: string) {
    const technician = await this.users.findById(assignedTo, tenantId);
    if (!technician) {
      throw new DomainException('Technician not found', 'HOME_SERVICE_TECHNICIAN_NOT_FOUND');
    }
    const updated = await this.repo.update(id, tenantId, { assignedTo, status: 'ASSIGNED' });
    if (!updated) return null;

    try {
      await this.messaging.sendDirectMessage(
        tenantId,
        updated.customerPhone,
        `Hola ${updated.customerName}, ${technician.fullName} fue asignado a tu servicio a domicilio y se dirigirá a tu ubicación pronto.`,
      );
    } catch (err) {
      this.logger.warn(`Assign notification failed for ${id}: ${String(err)}`);
    }
    return updated;
  }
}

@Injectable()
export class UpdateHomeServiceStatusUseCase {
  constructor(
    @Inject(HOME_SERVICE_REQUEST_REPOSITORY)
    private readonly repo: HomeServiceRequestRepository,
  ) {}

  async execute(id: string, tenantId: string, status: string) {
    if (!HOME_SERVICE_STATUSES.includes(status as (typeof HOME_SERVICE_STATUSES)[number])) {
      throw new DomainException(`Invalid status: ${status}`, 'HOME_SERVICE_INVALID_STATUS');
    }
    return this.repo.update(id, tenantId, { status });
  }
}
