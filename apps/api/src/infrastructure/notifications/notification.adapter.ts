import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NotificationPort } from '../../application/ports/notification.port';
import {
  NotificationRepository,
  NOTIFICATION_REPOSITORY,
  NotificationRecord,
} from '../../domain/repositories/notification.repository';
import { NotificationsGateway } from './notifications.gateway';
import { PrismaService } from '../persistence/prisma/prisma.service';

const KEEP_PER_USER = 100;

/** Human-readable title/body per notification type. */
const TEMPLATES: Record<string, { title: string; body: string }> = {
  WORK_ORDER_COMPLETED: { title: 'Orden completada', body: 'Una orden de trabajo fue completada.' },
  WORK_ORDER_NEAR_DEADLINE: { title: 'Orden por vencer', body: 'Una orden está próxima a su entrega.' },
  PAYMENT_REGISTERED: { title: 'Pago registrado', body: 'Se registró un nuevo pago.' },
  LOW_STOCK: { title: 'Stock bajo', body: 'Hay repuestos con stock por debajo del mínimo.' },
  WHATSAPP_UNKNOWN_NUMBER: { title: 'Mensaje de número desconocido', body: 'Llegó un mensaje de un número no registrado.' },
  WHATSAPP_ESCALATED: { title: 'Conversación escalada', body: 'El agente escaló una conversación a un humano.' },
  WHATSAPP_AGENT_ERROR: { title: 'Error del agente', body: 'El agente de IA encontró un error.' },
};

/**
 * Real NotificationPort: persists each notification (capping at 100 per user)
 * and pushes it over WebSocket. Replaces NotificationStubAdapter.
 */
@Injectable()
export class NotificationAdapter implements NotificationPort {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly repo: NotificationRepository,
    private readonly gateway: NotificationsGateway,
    private readonly prisma: PrismaService,
  ) {}

  async notifyUser(
    userId: string,
    payload: { type: string; title: string; body: string; resourceType?: string; resourceId?: string },
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { tenantId: true } });
    if (!user) return;
    await this.persistAndEmit({
      tenantId: user.tenantId,
      userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      resourceType: payload.resourceType ?? null,
      resourceId: payload.resourceId ?? null,
    });
  }

  async notifyAdmins(
    tenantId: string,
    payload: { type: string; workOrderId?: string; [key: string]: unknown },
  ): Promise<void> {
    const adminIds = await this.repo.findAdminUserIds(tenantId);
    const tpl = TEMPLATES[payload.type] ?? { title: 'Notificación', body: payload.type };
    const resourceId = (payload.workOrderId as string | undefined) ?? null;
    await Promise.all(
      adminIds.map((userId) =>
        this.persistAndEmit({
          tenantId,
          userId,
          type: payload.type,
          title: tpl.title,
          body: tpl.body,
          resourceType: resourceId ? 'work_order' : null,
          resourceId,
        }),
      ),
    );
  }

  private async persistAndEmit(input: Omit<NotificationRecord, 'id' | 'isRead' | 'readAt' | 'createdAt'>): Promise<void> {
    const record: NotificationRecord = {
      ...input,
      id: randomUUID(),
      isRead: false,
      readAt: null,
      createdAt: new Date(),
    };
    await this.repo.create(record);
    await this.repo.pruneOldForUser(input.userId, KEEP_PER_USER);
    this.gateway.emitToUser(input.userId, record);
  }
}
