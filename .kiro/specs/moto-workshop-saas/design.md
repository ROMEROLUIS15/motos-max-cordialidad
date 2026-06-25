# Design Document — MotoWorkshop SaaS (MVP — Un Solo Desarrollador)

---

## 1. Overview

MotoWorkshop SaaS es una plataforma multi-tenant para talleres y concesionarios de motocicletas en Latinoamérica. Este documento describe el diseño técnico del **MVP (Fase 1)**, optimizado para ser construido y mantenido por **una sola persona**.

El stack es NestJS + Next.js + PostgreSQL (Neon) + Cloudflare R2. La arquitectura sigue Clean Architecture con DDD: toda la lógica de negocio vive en casos de uso; los agentes de IA interactúan únicamente a través de herramientas tipadas; el sistema opera con plena funcionalidad si la IA no está disponible.

**Decisión Express vs Fastify**: se usa el adaptador HTTP por defecto de NestJS (Express). Fastify ofrece mayor rendimiento bruto, pero Express tiene mayor ecosistema de middlewares y es el default de NestJS. Para el volumen esperado del MVP, Express es suficiente. La migración a Fastify es posible sin cambiar los controladores.

**Scope Fase 1**: un único cliente (Barranquilla, Colombia). El alta de nuevos tenants es manual. No hay panel SuperAdmin.

---

## 2. Architecture

### Diagrama de Alto Nivel

```
┌──────────────────────────────────────────────────────────────────────┐
│                           INTERNET                                   │
└──────────┬───────────────────────────────────────┬───────────────────┘
           │                                       │
   ┌───────▼────────┐                   ┌──────────▼──────────┐
   │  Cloudflare    │                   │  Meta WhatsApp      │
   │  Pages         │                   │  Cloud API          │
   │  (Next.js 14)  │                   │  (Webhooks)         │
   └───────┬────────┘                   └──────────┬──────────┘
           │  HTTPS REST / WebSocket               │  HTTPS Webhook
   ┌───────▼───────────────────────────────────────▼──────────┐
   │                NestJS Backend (Docker)                    │
   │                                                           │
   │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐   │
   │  │Presentation │→ │ Application  │→ │    Domain      │   │
   │  │Controllers  │  │ Use Cases    │  │ Entities/VOs   │   │
   │  │Guards       │  │ DTOs / Ports │  │ Repo Interfaces│   │
   │  └─────────────┘  └──────────────┘  └────────────────┘   │
   │                                             ↑             │
   │  ┌──────────────────────────────────────────┘             │
   │  │                Infrastructure                          │
   │  │  Prisma │ R2 Client │ WhatsApp │ BullMQ │ Redis │ AI   │
   │  └────────────────────────────────────────────────────────│
   └────────┬──────────────────────────────────┬───────────────┘
            │                                  │
   ┌────────▼─────────┐             ┌──────────▼──────────┐
   │  PostgreSQL       │             │  Cloudflare R2      │
   │  (Neon Serverless)│             │  (Object Storage)   │
   └──────────────────┘             └─────────────────────┘
            │
   ┌────────▼─────────┐
   │  Redis            │
   │  BullMQ (WA) +    │
   │  Caché Tenant     │
   └──────────────────┘
```

### Regla de Dependencia (Clean Architecture)

```
presentation → application → domain
infrastructure ──────────→ domain  (implementa interfaces)
```

**Invariante absoluta**: ningún archivo dentro de `application/` o `domain/` puede importar desde `infrastructure/`. Los casos de uso no conocen Prisma, Redis ni ningún framework externo.


---

## 3. Repository Structure

### Backend — NestJS

```
apps/api/src/
├── domain/
│   ├── entities/
│   │   ├── tenant.entity.ts
│   │   ├── branch.entity.ts
│   │   ├── user.entity.ts
│   │   ├── customer.entity.ts
│   │   ├── vehicle.entity.ts
│   │   ├── vehicle-reception.entity.ts
│   │   ├── work-order.entity.ts
│   │   ├── part.entity.ts
│   │   ├── part-branch-stock.entity.ts
│   │   ├── quote.entity.ts
│   │   ├── payment.entity.ts
│   │   ├── whatsapp-session.entity.ts
│   │   ├── notification.entity.ts
│   │   └── service-catalog.entity.ts      ← NUEVO
│   ├── value-objects/
│   │   ├── document-type.vo.ts
│   │   ├── work-order-status.vo.ts
│   │   ├── quote-status.vo.ts
│   │   ├── service-type.vo.ts
│   │   ├── fuel-level.vo.ts
│   │   ├── payment-method.vo.ts
│   │   └── money.vo.ts
│   ├── repositories/
│   │   ├── tenant.repository.ts           (interface)
│   │   ├── branch.repository.ts           (interface)
│   │   ├── user.repository.ts             (interface)
│   │   ├── customer.repository.ts         (interface)
│   │   ├── vehicle.repository.ts          (interface)
│   │   ├── work-order.repository.ts       (interface)
│   │   ├── part.repository.ts             (interface)
│   │   ├── part-stock.repository.ts       (interface)  ← incluye transferAtomically()
│   │   ├── quote.repository.ts            (interface)
│   │   ├── payment.repository.ts          (interface)
│   │   ├── notification.repository.ts     (interface)
│   │   └── service-catalog.repository.ts  (interface)  ← NUEVO
│   └── exceptions/
│       ├── domain.exception.ts
│       ├── work-order-invalid-transition.exception.ts
│       ├── insufficient-stock.exception.ts
│       ├── vehicle-has-active-order.exception.ts
│       └── duplicate-document.exception.ts
│
│   NOTA: NO existe domain/events/ en Fase 1.
│         Los efectos se ejecutan directamente en los use cases.
│
├── application/
│   ├── use-cases/
│   │   ├── identity/
│   │   ├── customers/
│   │   ├── vehicles/
│   │   ├── workshop/
│   │   ├── inventory/
│   │   ├── commerce/
│   │   ├── messaging/
│   │   ├── ai/
│   │   ├── dashboard/
│   │   ├── audit/
│   │   └── service-catalog/               ← NUEVO
│   │       ├── create-service-catalog-item.use-case.ts
│   │       ├── update-service-catalog-item.use-case.ts
│   │       ├── deactivate-service-catalog-item.use-case.ts
│   │       └── list-service-catalog-items.use-case.ts
│   ├── dtos/
│   └── ports/
│       ├── storage.port.ts
│       ├── messaging.port.ts
│       ├── pdf-generator.port.ts
│       ├── llm-provider.port.ts
│       ├── jwt.port.ts                  ← interfaz JwtPort (sign/verify)
│       ├── inventory.port.ts
│       └── notification.port.ts
│       ── NO EventEmitterPort (eliminado)
│       ── NO InvoiceProvider (eliminado — ver commerce.module.ts)
│
├── infrastructure/
│   ├── persistence/prisma/
│   │   ├── repositories/                  (implementaciones Prisma)
│   │   ├── mappers/                       (Prisma model ↔ Domain entity)
│   │   └── prisma.service.ts
│   ├── auth/
│   │   ├── jwt.service.ts               ← jsonwebtoken (sin @nestjs/jwt)
│   │   └── password.service.ts          ← bcrypt (sin @nestjs/passport)
│   ├── storage/cloudflare-r2.adapter.ts
│   ├── messaging/whatsapp-cloud.adapter.ts
│   ├── pdf/react-pdf.adapter.ts           ← @react-pdf/renderer (síncrono)
│   ├── ai/
│   │   ├── deepseek.adapter.ts
│   │   ├── groq.adapter.ts
│   │   ├── llm-provider.factory.ts
│   │   └── tools/
│   │       ├── tool-registry.ts
│   │       ├── tool-executor.ts
│   │       └── implementations/
│   ├── queue/
│   │   ├── bullmq.module.ts
│   │   ├── producers/
│   │   │   └── whatsapp-outbound.producer.ts
│   │   └── workers/
│   │       └── whatsapp-outbound.worker.ts  ← ÚNICA cola
│   ├── scheduler/
│   │   └── delivery-alerts.scheduler.ts    ← @nestjs/schedule @Cron
│   ├── cache/redis-cache.adapter.ts
│   └── observability/sentry.adapter.ts
│
└── presentation/
    ├── http/
    │   ├── guards/
    │   │   ├── jwt-auth.guard.ts          ← implementación manual (sin Passport)
    │   │   └── permission.guard.ts        ← resuelve permisos desde caché Redis
    │   ├── interceptors/
    │   │   ├── trace-id.interceptor.ts
    │   │   ├── audit-log.interceptor.ts
    │   │   └── response-transform.interceptor.ts
    │   ├── decorators/
    │   │   ├── current-user.decorator.ts
    │   │   └── require-permission.decorator.ts
    │   └── controllers/
    │       ├── auth.controller.ts
    │       ├── tenants.controller.ts
    │       ├── branches.controller.ts
    │       ├── users.controller.ts
    │       ├── customers.controller.ts
    │       ├── vehicles.controller.ts
    │       ├── receptions.controller.ts
    │       ├── work-orders.controller.ts
    │       ├── parts.controller.ts
    │       ├── stock.controller.ts
    │       ├── quotes.controller.ts
    │       ├── payments.controller.ts
    │       ├── messages.controller.ts
    │       ├── webhooks.controller.ts
    │       ├── dashboard.controller.ts
    │       ├── service-catalog.controller.ts  ← NUEVO
    │       ├── audit.controller.ts
    │       └── health.controller.ts
    └── websocket/
        └── notifications.gateway.ts
```

### Frontend — Next.js 14

```
apps/web/src/
├── app/
│   ├── (auth)/login/
│   └── (dashboard)/
│       ├── layout.tsx
│       ├── page.tsx                        (Dashboard)
│       ├── customers/
│       ├── vehicles/
│       ├── receptions/
│       ├── work-orders/
│       ├── inventory/
│       ├── service-catalog/                ← NUEVO
│       ├── commerce/
│       │   ├── quotes/
│       │   └── payments/
│       ├── messages/
│       ├── settings/
│       └── audit/
├── components/
│   ├── ui/                                 (shadcn/ui)
│   ├── layout/
│   ├── work-orders/
│   ├── inventory/
│   ├── dashboard/
│   └── messages/
├── hooks/
├── lib/
│   ├── api.ts
│   └── websocket.ts
└── types/api.ts
```


---

## 4. Domain Model

### WorkOrder — State Machine

```typescript
// domain/value-objects/work-order-status.vo.ts
export enum WorkOrderStatus {
  PENDING        = 'PENDING',
  IN_PROGRESS    = 'IN_PROGRESS',
  WAITING_PARTS  = 'WAITING_PARTS',
  COMPLETED      = 'COMPLETED',
  DELIVERED      = 'DELIVERED',
  CANCELLED      = 'CANCELLED',
}

const VALID_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  [WorkOrderStatus.PENDING]:       [WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.CANCELLED],
  [WorkOrderStatus.IN_PROGRESS]:   [WorkOrderStatus.WAITING_PARTS, WorkOrderStatus.COMPLETED, WorkOrderStatus.CANCELLED],
  [WorkOrderStatus.WAITING_PARTS]: [WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.CANCELLED],
  [WorkOrderStatus.COMPLETED]:     [WorkOrderStatus.DELIVERED, WorkOrderStatus.CANCELLED],
  [WorkOrderStatus.DELIVERED]:     [],   // terminal
  [WorkOrderStatus.CANCELLED]:     [],   // terminal
};

export function isValidTransition(from: WorkOrderStatus, to: WorkOrderStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}
```

### WorkOrder Entity

```typescript
// domain/entities/work-order.entity.ts
export class WorkOrder {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly branchId: string,
    public readonly orderNumber: string,
    public readonly receptionId: string,
    public readonly vehicleId: string,
    public readonly customerId: string,
    public technicianId: string,
    public status: WorkOrderStatus,
    public readonly promisedDeliveryAt: Date,
    public finalOdometer: number | null,
    public readonly createdAt: Date,
    public deletedAt: Date | null,
  ) {}

  /**
   * Cambia el estado. Lanza excepción si la transición no está permitida.
   * Retorna el registro del cambio (previousStatus, newStatus) para que
   * el use case lo persista en statusHistory — sin eventos de dominio.
   */
  transitionTo(newStatus: WorkOrderStatus): { previousStatus: WorkOrderStatus; newStatus: WorkOrderStatus } {
    if (!isValidTransition(this.status, newStatus)) {
      throw new WorkOrderInvalidTransitionException(this.status, newStatus);
    }
    const previousStatus = this.status;
    this.status = newStatus;
    return { previousStatus, newStatus };
  }

  isNearDeadline(hoursThreshold = 2): boolean {
    const threshold = new Date(Date.now() + hoursThreshold * 60 * 60 * 1000);
    return this.promisedDeliveryAt <= threshold
      && ![WorkOrderStatus.COMPLETED, WorkOrderStatus.DELIVERED, WorkOrderStatus.CANCELLED]
          .includes(this.status);
  }

  softDelete(): void {
    if (this.status === WorkOrderStatus.DELIVERED) {
      throw new DomainException('No se puede eliminar una WorkOrder entregada.');
    }
    this.deletedAt = new Date();
  }
}
```

### PartBranchStock — Invariante de Tres Niveles

```typescript
// domain/entities/part-branch-stock.entity.ts
export class PartBranchStock {
  constructor(
    public readonly id: string,
    public readonly partId: string,
    public readonly branchId: string,
    private _stockFisico: number,
    private _stockReservado: number,
  ) {}

  get stockFisico(): number { return this._stockFisico; }
  get stockReservado(): number { return this._stockReservado; }
  get stockDisponible(): number { return this._stockFisico - this._stockReservado; }

  reserve(quantity: number): void {
    if (this.stockDisponible < quantity) {
      throw new InsufficientStockException(this.partId, quantity, this.stockDisponible);
    }
    this._stockReservado += quantity;
  }

  releaseReservation(quantity: number): void {
    this._stockReservado = Math.max(0, this._stockReservado - quantity);
  }

  confirmDiscount(quantity: number): void {
    if (this._stockFisico < quantity) {
      throw new DomainException('Stock físico insuficiente para confirmar descuento.');
    }
    this._stockFisico -= quantity;
    this._stockReservado = Math.max(0, this._stockReservado - quantity);
  }

  addStock(quantity: number): void {
    if (quantity <= 0) throw new DomainException('La cantidad de entrada debe ser mayor a cero.');
    this._stockFisico += quantity;
  }

  adjust(newPhysicalCount: number): number {
    const difference = newPhysicalCount - this._stockFisico;
    this._stockFisico = newPhysicalCount;
    return difference; // positivo = ganancia, negativo = merma
  }
}
```

### ServiceCatalog Entity (NUEVA)

```typescript
// domain/entities/service-catalog.entity.ts
export class ServiceCatalogItem {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public name: string,
    public description: string | null,
    public estimatedHours: number,
    public suggestedPrice: number,
    public serviceType: ServiceType,
    public isActive: boolean,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  deactivate(): void {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  update(data: Partial<Pick<ServiceCatalogItem, 'name' | 'description' | 'estimatedHours' | 'suggestedPrice' | 'serviceType'>>): void {
    Object.assign(this, data);
    this.updatedAt = new Date();
  }
}
```

```typescript
// domain/repositories/service-catalog.repository.ts
export interface ServiceCatalogRepository {
  findById(id: string, tenantId: string): Promise<ServiceCatalogItem | null>;
  findAll(tenantId: string, filters: ServiceCatalogFilters): Promise<ServiceCatalogItem[]>;
  save(item: ServiceCatalogItem): Promise<void>;
  create(item: ServiceCatalogItem): Promise<void>;
}

export interface ServiceCatalogFilters {
  serviceType?: ServiceType;
  search?: string;       // búsqueda por name
  isActive?: boolean;
}
```

**WorkOrderLine — campo opcional serviceCatalogId**:

```typescript
interface WorkOrderLine {
  id: string;
  workOrderId: string;
  description: string;
  estimatedHours: number;
  unitPrice: number;
  technicianId: string;
  serviceCatalogId?: string | null;  // null = texto libre, string = precargado del catálogo
}
```


---

## 5. API Design

Toda la paginación usa **offset pagination** exclusivamente: parámetros `page` (1-indexed) y `pageSize`.

### Authentication

```
POST /api/auth/login
  Body: { email: string; password: string }
  Response: { accessToken: string; refreshToken: string; user: UserDto }

POST /api/auth/refresh
  Body: { refreshToken: string }
  Response: { accessToken: string; refreshToken: string }

POST /api/auth/logout
  Headers: Authorization: Bearer <token>
  Response: 204 No Content
```

### Customers

```
GET    /api/customers?search=&page=&pageSize=
POST   /api/customers
GET    /api/customers/:id
PUT    /api/customers/:id
DELETE /api/customers/:id              (soft delete)
GET    /api/customers/:id/vehicles
GET    /api/customers/:id/work-orders
```

### Vehicles

```
GET    /api/vehicles?customerId=&page=&pageSize=
POST   /api/vehicles
GET    /api/vehicles/:id
PUT    /api/vehicles/:id
DELETE /api/vehicles/:id               (soft delete)
POST   /api/vehicles/:id/transfer
GET    /api/vehicles/:id/history
```

### Vehicle Receptions

```
POST   /api/receptions
GET    /api/receptions/:id
POST   /api/receptions/:id/photos      (multipart/form-data)
DELETE /api/receptions/:id/photos/:photoId
```

### Work Orders

```
GET    /api/work-orders?status=&branchId=&technicianId=&from=&to=&page=&pageSize=
POST   /api/work-orders
GET    /api/work-orders/:id
PUT    /api/work-orders/:id
DELETE /api/work-orders/:id            (soft delete)

POST   /api/work-orders/:id/status              { status, note?, finalOdometer? }
POST   /api/work-orders/:id/lines               (agregar línea — acepta serviceCatalogId?)
PUT    /api/work-orders/:id/lines/:lineId
DELETE /api/work-orders/:id/lines/:lineId
POST   /api/work-orders/:id/parts               (agrega repuesto — reserva stock)
DELETE /api/work-orders/:id/parts/:partId       (libera reserva)
POST   /api/work-orders/:id/evidences           (multipart/form-data)
DELETE /api/work-orders/:id/evidences/:evidenceId
GET    /api/work-orders/:id/evidences           (retorna URLs pre-firmadas 24h)
```

### Inventory

```
GET    /api/parts?search=&category=&page=&pageSize=
POST   /api/parts
GET    /api/parts/:id
PUT    /api/parts/:id
DELETE /api/parts/:id

GET    /api/stock?branchId=&partId=
POST   /api/stock/entry          { partId, branchId, quantity, type: 'ENTRADA', notes? }
POST   /api/stock/exit           { partId, branchId, quantity, notes? }
POST   /api/stock/adjust         { partId, branchId, countedQuantity, notes (obligatorio) }
POST   /api/stock/transfer       { partId, fromBranchId, toBranchId, quantity }
GET    /api/stock/history?partId=&branchId=&from=&to=&page=&pageSize=
GET    /api/stock/valuation?branchId=
GET    /api/stock/low-stock?branchId=
```

### Service Catalog (NUEVO)

```
GET    /api/service-catalog?serviceType=&search=&isActive=&page=&pageSize=
POST   /api/service-catalog
GET    /api/service-catalog/:id
PUT    /api/service-catalog/:id
POST   /api/service-catalog/:id/deactivate
```

El endpoint `GET /api/service-catalog?search=` está diseñado para autocompletado en el formulario de WorkOrderLine. El catálogo es por Tenant; cada taller define sus propios servicios.

### Commerce

```
GET    /api/quotes?workOrderId=&status=&page=&pageSize=
POST   /api/quotes
GET    /api/quotes/:id
PUT    /api/quotes/:id
POST   /api/quotes/:id/send
POST   /api/quotes/:id/approve
POST   /api/quotes/:id/reject
GET    /api/quotes/:id/pdf             (retorna URL pre-firmada 24h)
GET    /api/quotes/:id/versions

GET    /api/payments?workOrderId=&branchId=&from=&to=&page=&pageSize=
POST   /api/payments
GET    /api/payments/:id
GET    /api/payments/summary/:workOrderId
```

### Messages (WhatsApp)

```
GET    /api/messages/sessions?page=&pageSize=
GET    /api/messages/sessions/:sessionId
GET    /api/messages/sessions/:sessionId/messages
POST   /api/messages/send            { customerId, content }
POST   /api/webhooks/whatsapp        (Meta webhook — sin JWT; verifica firma HMAC-SHA256)
```

### Dashboard (consolidado)

```
GET    /api/dashboard/summary?branchId=&from=&to=
```

Retorna TODO en una sola llamada usando `Promise.all` internamente:
- WorkOrders activas por estado
- Total cobrado del día y del mes
- Promedio de tiempo de ciclo
- Alertas de stock bajo
- WorkOrders próximas a vencer (≤ 2h)
- Ranking top 5 técnicos
- Tendencia de ingresos últimos 30 días (diaria)
- Top 10 parts con mayor rotación
- Alerta si WAITING_PARTS > 5 simultáneas

No existen sub-endpoints separados para el dashboard.

### Audit

```
GET    /api/audit?entityType=&entityId=&userId=&action=&from=&to=&page=&pageSize=
```

### Health Check

```
GET    /api/health
Response: { status: 'ok' | 'degraded', database, redis, r2, bullmq, whatsapp }
```


---

## 6. Key Design Patterns

### 1. Aislamiento Multi-Tenant

El aislamiento de datos se garantiza porque **todos los repositorios incluyen `tenantId` obligatoriamente en cada query**. No existe un guard HTTP separado para esto — la estrategia es estructural, no de middleware.

```typescript
// infrastructure/persistence/prisma/repositories/work-order.prisma-repository.ts
@Injectable()
export class WorkOrderPrismaRepository implements WorkOrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Retorna WorkOrder con datos básicos — usar en listados
  async findById(id: string, tenantId: string): Promise<WorkOrder | null> {
    const record = await this.prisma.workOrder.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    return record ? WorkOrderMapper.toDomain(record) : null;
  }

  // Retorna WorkOrder completa con relaciones — usar solo en endpoint de detalle
  async findByIdWithDetails(id: string, tenantId: string): Promise<WorkOrder | null> {
    const record = await this.prisma.workOrder.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        lines: true,
        parts: true,
        statusHistory: true,
        photoEvidences: true,
      },
    });
    return record ? WorkOrderMapper.toDomainWithDetails(record) : null;
  }

  async findByBranch(
    branchId: string,
    tenantId: string,
    filters: WorkOrderFilters,
  ): Promise<PaginatedResult<WorkOrder>> {
    const where = {
      branchId,
      tenantId,
      deletedAt: null,
      ...(filters.status && { status: filters.status }),
      ...(filters.technicianId && { technicianId: filters.technicianId }),
    };
    const [items, total] = await Promise.all([
      this.prisma.workOrder.findMany({
        where,
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.workOrder.count({ where }),
    ]);
    return { items: items.map(WorkOrderMapper.toDomain), total, page: filters.page, pageSize: filters.pageSize };
  }
}
```

Si un recurso existe pero pertenece a otro tenant, el repositorio retorna `null` y el use case lanza `NotFoundException` — el cliente recibe 404, nunca información de otro tenant.

### 2. Use Case Pattern — TransitionWorkOrderStatus (sin EventEmitterPort)

Los efectos secundarios de la transición se ejecutan **directamente** en el use case. No existe `EventEmitterPort` ni indirección de eventos.

```typescript
// application/use-cases/workshop/transition-work-order-status.use-case.ts
export interface TransitionWorkOrderStatusInput {
  workOrderId: string;
  newStatus: WorkOrderStatus;
  changedBy: string;
  tenantId: string;
  note?: string;
  finalOdometer?: number;
}

export interface TransitionWorkOrderStatusOutput {
  workOrderId: string;
  previousStatus: WorkOrderStatus;
  newStatus: WorkOrderStatus;
}

@Injectable()
export class TransitionWorkOrderStatusUseCase {
  constructor(
    private readonly workOrderRepo: WorkOrderRepository,
    private readonly inventoryPort: InventoryPort,
    private readonly messagingPort: MessagingPort,
    private readonly notificationPort: NotificationPort,
  ) {}

  async execute(input: TransitionWorkOrderStatusInput): Promise<TransitionWorkOrderStatusOutput> {
    const workOrder = await this.workOrderRepo.findById(input.workOrderId, input.tenantId);
    if (!workOrder) throw new NotFoundException('WorkOrder no encontrada.');

    const change = workOrder.transitionTo(input.newStatus);

    // Efectos directos — sin eventos intermedios
    if (input.newStatus === WorkOrderStatus.DELIVERED) {
      await this.inventoryPort.confirmStockDiscount(input.workOrderId, input.tenantId);
    }

    if (input.newStatus === WorkOrderStatus.CANCELLED) {
      await this.inventoryPort.releaseAllReservations(input.workOrderId, input.tenantId);
    }

    if (input.newStatus === WorkOrderStatus.COMPLETED) {
      if (input.finalOdometer) workOrder.finalOdometer = input.finalOdometer;
      await this.messagingPort.sendWorkOrderCompletedNotification(workOrder);
      await this.notificationPort.notifyAdmins(workOrder.tenantId, {
        type: 'WORK_ORDER_COMPLETED',
        workOrderId: workOrder.id,
      });
    }

    if (input.newStatus === WorkOrderStatus.WAITING_PARTS) {
      await this.messagingPort.sendWaitingPartsNotification(workOrder);
    }

    await this.workOrderRepo.save(workOrder);
    await this.workOrderRepo.saveStatusHistory({
      workOrderId: workOrder.id,
      previousStatus: change.previousStatus,
      newStatus: change.newStatus,
      changedBy: input.changedBy,
      note: input.note ?? null,
      changedAt: new Date(),
    });

    return { workOrderId: workOrder.id, ...change };
  }
}
```

### 3. Stock Transfer — Transacción en el Repositorio

La lógica de transacción Prisma vive en la **implementación del repositorio** (`infrastructure/`), no en el use case. El use case solo llama `partStockRepo.transferAtomically(input)`.

```typescript
// domain/repositories/part-stock.repository.ts (interface)
export interface PartStockRepository {
  findByPartAndBranch(partId: string, branchId: string): Promise<PartBranchStock | null>;
  save(stock: PartBranchStock): Promise<void>;
  transferAtomically(input: TransferStockInput): Promise<void>;
  // ... otros métodos
}

// application/use-cases/inventory/transfer-stock.use-case.ts
@Injectable()
export class TransferStockBetweenBranchesUseCase {
  constructor(
    private readonly partStockRepo: PartStockRepository,  // NO PrismaService
  ) {}

  async execute(input: TransferStockInput): Promise<void> {
    // Validaciones de negocio (opcionales aquí si el repo las hace internamente)
    await this.partStockRepo.transferAtomically(input);
  }
}

// infrastructure/persistence/prisma/repositories/part-stock.prisma-repository.ts
@Injectable()
export class PartStockPrismaRepository implements PartStockRepository {
  constructor(private readonly prisma: PrismaService) {}

  async transferAtomically(input: TransferStockInput): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const source = await tx.partBranchStock.findUnique({
        where: { partId_branchId: { partId: input.partId, branchId: input.fromBranchId } },
      });
      if (!source || (source.stockFisico - source.stockReservado) < input.quantity) {
        throw new InsufficientStockException(input.partId, input.quantity, 0);
      }

      await tx.partBranchStock.upsert({
        where: { partId_branchId: { partId: input.partId, branchId: input.toBranchId } },
        create: { partId: input.partId, branchId: input.toBranchId, stockFisico: 0, stockReservado: 0 },
        update: {},
      });

      await tx.partBranchStock.update({
        where: { partId_branchId: { partId: input.partId, branchId: input.fromBranchId } },
        data: { stockFisico: { decrement: input.quantity } },
      });
      await tx.partBranchStock.update({
        where: { partId_branchId: { partId: input.partId, branchId: input.toBranchId } },
        data: { stockFisico: { increment: input.quantity } },
      });

      await tx.stockEntry.createMany({
        data: [
          { type: 'SALIDA', quantity: -input.quantity, partId: input.partId, branchId: input.fromBranchId, userId: input.userId, tenantId: input.tenantId, notes: `Transferencia a sucursal ${input.toBranchId}` },
          { type: 'ENTRADA', quantity: input.quantity, partId: input.partId, branchId: input.toBranchId, userId: input.userId, tenantId: input.tenantId, notes: `Transferencia desde sucursal ${input.fromBranchId}` },
        ],
      });
    });
  }
}
```

### 4. AI Tool Executor — Stateless (corrección de bug singleton)

El `callCount` **no** es propiedad del servicio singleton. El límite se trackea por conversación: el `RouterAgent` mantiene el contador y lo pasa en cada invocación. El `ToolExecutor` es completamente stateless.

```typescript
// infrastructure/ai/tool-executor.ts
export interface ExecutionContext {
  sessionId: string;
  messageId: string;
  callCount: number;  // El caller (RouterAgent) mantiene este valor
}

@Injectable()
export class ToolExecutor {
  private readonly MAX_TOOL_CALLS = 5;

  constructor(
    private readonly toolRegistry: ToolRegistry,
    private readonly auditLogger: AIInvocationLogger,
  ) {}

  // El ToolExecutor NO mantiene estado propio. Es stateless.
  async execute<I, O>(toolName: string, rawInput: unknown, context: ExecutionContext): Promise<O> {
    if (context.callCount >= this.MAX_TOOL_CALLS) {
      throw new ToolLimitExceededException(context.sessionId, context.callCount);
    }

    const tool = this.toolRegistry.get(toolName);
    if (!tool) throw new UnknownToolException(toolName);

    const parseResult = tool.inputSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new ToolValidationException(toolName, parseResult.error.issues);
    }

    const startTime = Date.now();

    try {
      const result = await Promise.race([
        tool.execute(parseResult.data as I),
        this.timeout<O>(5_000),
      ]);

      await this.auditLogger.log({
        sessionId: context.sessionId,
        messageId: context.messageId,
        toolName,
        input: this.sanitize(parseResult.data),
        output: result,
        durationMs: Date.now() - startTime,
        succeeded: true,
      });

      return result as O;
    } catch (error) {
      await this.auditLogger.log({
        sessionId: context.sessionId,
        messageId: context.messageId,
        toolName,
        input: this.sanitize(parseResult.data),
        durationMs: Date.now() - startTime,
        succeeded: false,
        failureReason: error instanceof Error ? error.message : 'unknown',
      });
      throw error;
    }
  }

  private timeout<T>(ms: number): Promise<T> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new ToolTimeoutException()), ms),
    );
  }

  private sanitize(data: unknown): Record<string, unknown> {
    const sensitive = ['password', 'token', 'secret', 'creditCard'];
    return JSON.parse(JSON.stringify(data, (key, val) =>
      sensitive.some(s => key.toLowerCase().includes(s)) ? '[REDACTED]' : val,
    ));
  }
}
```

```typescript
// Uso correcto en RouterAgent — el caller mantiene el callCount por conversación
class RouterAgent {
  async processMessage(sessionId: string, messageId: string, message: string): Promise<string> {
    let callCount = 0;

    // El RouterAgent incrementa callCount antes de cada invocación y lo pasa
    const callTool = async (toolName: string, input: unknown) => {
      const result = await this.toolExecutor.execute(toolName, input, {
        sessionId,
        messageId,
        callCount,
      });
      callCount++;  // Incrementar DESPUÉS de la llamada exitosa
      return result;
    };

    // ... lógica del agente usando callTool
  }
}
```

### 5. Audit Log Interceptor

Captura `new_data` (respuesta HTTP) automáticamente. Para operaciones UPDATE/DELETE en entidades críticas (WorkOrder, Payment), el `previous_data` se captura manualmente en el use case con un read-before-write. El interceptor es válido para CREATE sin modificación.

`previous_data` en UPDATE/DELETE se implementa en Fase 2 de forma genérica; en Fase 1, los use cases críticos lo hacen manualmente cuando se necesite auditoría completa.

```typescript
// presentation/http/interceptors/audit-log.interceptor.ts
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly auditRepo: AuditLogRepository) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, user, params } = request;
    const writeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (!writeMethods.includes(method)) return next.handle();

    return next.handle().pipe(
      tap((response) => {
        this.auditRepo.log({
          tenantId: user.tenantId,
          branchId: user.branchId,
          actorUserId: user.userId,
          entityType: this.extractEntityType(request.path),
          entityId: params.id ?? response?.id,
          action: this.methodToAction(method),
          newData: response,     // Captura automática para CREATE
          previousData: null,    // Fase 2: read-before-write en use cases críticos
          traceId: request.traceId,
          ipAddress: request.ip,
        }).catch(() => { /* no bloquea la respuesta */ });
      }),
    );
  }

  private extractEntityType(path: string): string {
    return path.split('/')[2] ?? 'unknown';
  }

  private methodToAction(method: string): string {
    const map: Record<string, string> = { POST: 'CREATE', PUT: 'UPDATE', PATCH: 'UPDATE', DELETE: 'DELETE' };
    return map[method] ?? method;
  }
}
```

### 6. LLM Provider con Fallback

```typescript
// infrastructure/ai/llm-provider.factory.ts
@Injectable()
export class LLMProviderFactory {
  constructor(
    private readonly deepseek: DeepSeekAdapter,
    private readonly groq: GroqAdapter,
  ) {}

  async complete(request: LLMRequest): Promise<LLMResponse> {
    try {
      return await this.deepseek.complete(request);
    } catch (e) {
      Sentry.captureException(e, { tags: { provider: 'deepseek' } });
    }
    try {
      return await this.groq.complete(request);
    } catch (e) {
      Sentry.captureException(e, { tags: { provider: 'groq' } });
    }
    throw new AllLLMProvidersFailedException();
  }
}
```


---

## 7. Security Design

### Decisión de Autenticación: jsonwebtoken + bcrypt (sin @nestjs/passport)

Se implementa autenticación manualmente usando `jsonwebtoken` y `bcrypt` directamente. No se usan `@nestjs/passport`, `@nestjs/jwt` ni estrategias de Passport. Esto elimina una capa de abstracción innecesaria y hace el código más legible para un equipo de una persona.

**Dependencias de autenticación:**
```
jsonwebtoken     — firma y verificación de JWTs
bcrypt           — hashing de contraseñas
```

Sin `passport`, sin `strategies`, sin `ExtractJwt`. El `JwtService` y el `JwtAuthGuard` se implementan desde cero en ~50 líneas.

### JWT Payload — Solo roleId (sin permissions[])

El JWT **no incluye** `permissions[]`. Solo lleva `roleId`. El `PermissionGuard` resuelve los permisos del `roleId` desde caché Redis (TTL 5 min). Esto evita JWTs inflados y garantiza que la revocación de permisos surta efecto en máximo 5 minutos.

```typescript
// application/ports/jwt.port.ts — interfaz en la capa de aplicación
export interface JwtPort {
  sign(payload: JWTPayload): string;
  verify(token: string): JWTPayload;
}

export interface JWTPayload {
  sub: string;       // userId
  tenantId: string;
  branchId: string;
  roleId: string;    // Solo roleId — los permisos se resuelven en runtime
  iat?: number;
  exp?: number;
}
```

```typescript
// infrastructure/auth/jwt.service.ts — implementación con jsonwebtoken
import { sign, verify, JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

@Injectable()
export class JwtService implements JwtPort {
  private readonly secret: string;
  private readonly expiresIn: string;

  constructor(private readonly config: ConfigService) {
    this.secret  = this.config.getOrThrow('JWT_SECRET');
    this.expiresIn = this.config.get('JWT_EXPIRY') ?? '15m';
  }

  sign(payload: JWTPayload): string {
    return sign(payload, this.secret, { expiresIn: this.expiresIn });
  }

  verify(token: string): JWTPayload {
    try {
      return verify(token, this.secret) as JWTPayload;
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new UnauthorizedException('Token expirado');
      }
      throw new UnauthorizedException('Token inválido');
    }
  }
}
```

```typescript
// infrastructure/auth/password.service.ts — hashing con bcrypt
import { hash, compare } from 'bcrypt';

@Injectable()
export class PasswordService {
  private readonly SALT_ROUNDS = 12;

  async hash(plaintext: string): Promise<string> {
    return hash(plaintext, this.SALT_ROUNDS);
  }

  async verify(plaintext: string, hashed: string): Promise<boolean> {
    return compare(plaintext, hashed);
  }
}
```

```typescript
// presentation/http/guards/jwt-auth.guard.ts — guard manual sin Passport
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: JWTPayload }>();
    const token = this.extractTokenFromHeader(request);
    if (!token) throw new UnauthorizedException('Token requerido');

    const payload = this.jwtService.verify(token); // lanza UnauthorizedException si es inválido
    request.user = payload;
    return true;
  }

  private extractTokenFromHeader(request: Request): string | null {
    const [type, token] = (request.headers['authorization'] ?? '').split(' ');
    return type === 'Bearer' ? token : null;
  }
}
```

```typescript
// presentation/http/guards/permission.guard.ts
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly cache: RedisCacheAdapter,
    private readonly roleRepo: RoleRepository,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.get<string>('permission', context.getHandler());
    if (!requiredPermission) return true;

    const { user } = context.switchToHttp().getRequest();
    const cacheKey = `role:${user.roleId}:permissions`;

    let permissions: string[] = await this.cache.get(cacheKey);
    if (!permissions) {
      const role = await this.roleRepo.findByIdWithPermissions(user.roleId);
      permissions = role?.permissions.map(p => p.key) ?? [];
      await this.cache.set(cacheKey, permissions, 300); // TTL 5 min
    }

    return permissions.includes(requiredPermission);
  }
}
```

```typescript
// application/use-cases/identity/authenticate-user.use-case.ts
@Injectable()
export class AuthenticateUserUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
    private readonly refreshTokenRepo: RefreshTokenRepository,
  ) {}

  async execute(input: AuthenticateUserInput): Promise<AuthenticateUserOutput> {
    const user = await this.userRepo.findByEmail(input.email, input.tenantId);
    if (!user || !user.isActive) throw new UnauthorizedException('Credenciales inválidas');

    const isValid = await this.passwordService.verify(input.password, user.passwordHash);
    if (!isValid) throw new UnauthorizedException('Credenciales inválidas');

    const payload: JWTPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      branchId: user.branchId ?? '',
      roleId: user.roleId,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = await this.refreshTokenRepo.create(user.id);

    return { accessToken, refreshToken, user: UserMapper.toDto(user) };
  }
}
```

```typescript
// application/use-cases/identity/refresh-token.use-case.ts
@Injectable()
export class RefreshTokenUseCase {
  async execute(input: { refreshToken: string }): Promise<{ accessToken: string; refreshToken: string }> {
    const storedToken = await this.refreshTokenRepo.findAndRotate(input.refreshToken);
    if (!storedToken) throw new UnauthorizedException('Refresh token inválido o expirado');

    const user = await this.userRepo.findById(storedToken.userId);
    const accessToken = this.jwtService.sign({
      sub: user.id,
      tenantId: user.tenantId,
      branchId: user.branchId ?? '',
      roleId: user.roleId,
    });

    return { accessToken, refreshToken: storedToken.newToken };
  }
}
```

**Refresh token — rotación en cada uso**: `findAndRotate` invalida el token actual y crea uno nuevo en la misma transacción. El token se almacena hasheado en la tabla `refresh_tokens`.

### Guard Execution Order

```
Request → JwtAuthGuard → PermissionGuard → Controller
```

El aislamiento de tenant **no** requiere un guard HTTP separado: los repositorios siempre filtran por `tenantId`. Si un recurso no pertenece al tenant del usuario, el repositorio retorna `null` y el use case lanza 404.

### Verificación de Firma del Webhook WhatsApp

El endpoint `POST /api/webhooks/whatsapp` **no requiere JWT** (es llamado por Meta), pero **verifica la firma HMAC-SHA256** del header `X-Hub-Signature-256` usando `META_WHATSAPP_APP_SECRET`. Sin esta verificación, cualquiera podría inyectar mensajes falsos.

```typescript
// presentation/http/controllers/webhooks.controller.ts
@Post('whatsapp')
async receiveWhatsAppWebhook(
  @Headers('x-hub-signature-256') signature: string,
  @RawBody() rawBody: Buffer,
  @Body() body: WhatsAppWebhookDto,
): Promise<void> {
  const isValid = this.verifyWebhookSignature(rawBody, signature);
  if (!isValid) throw new UnauthorizedException('Firma de webhook inválida');
  await this.whatsAppWebhookUseCase.execute(body);
}

private verifyWebhookSignature(payload: Buffer, signature: string): boolean {
  const expected = 'sha256=' + createHmac('sha256', this.appSecret)
    .update(payload)
    .digest('hex');
  // Comparación en tiempo constante para prevenir timing attacks
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

Importar `createHmac` y `timingSafeEqual` desde `node:crypto` (nativo de Node.js, sin dependencias adicionales).

### Cifrado de whatsapp_token

El campo `whatsapp_token` (token de acceso de Meta por tenant) se almacena cifrado en la base de datos usando **AES-256-GCM** con una clave derivada de la variable de entorno `ENCRYPTION_KEY`. La implementación usa `node:crypto` (nativo).

```typescript
// infrastructure/crypto/field-encryption.service.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;  // 96 bits — recomendado para GCM

@Injectable()
export class FieldEncryptionService {
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const envKey = this.configService.get<string>('ENCRYPTION_KEY');
    // ENCRYPTION_KEY debe ser un hex string de 64 chars (32 bytes)
    this.key = Buffer.from(envKey, 'hex');
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Formato: iv(12) + tag(16) + ciphertext — todo en base64
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  decrypt(ciphertext: string): string {
    const buf = Buffer.from(ciphertext, 'base64');
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + 16);
    const encrypted = buf.subarray(IV_LENGTH + 16);
    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final('utf8');
  }
}
```

`ENCRYPTION_KEY` se genera una vez con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` y se almacena como secreto de entorno. **Nunca** en el repositorio.

### Rate Limiting

Rate limiting con `@nestjs/throttler` **en memoria** (no Redis-backed). Redis se reserva para BullMQ y caché de permisos/tenant.

```typescript
ThrottlerModule.forRoot([
  { name: 'global', ttl: 60_000, limit: 100 },   // 100 req/min por IP
  { name: 'auth',   ttl: 300_000, limit: 5 },     // 5 intentos/5min en login
])
```

### File Upload Validation

```typescript
const FILE_VALIDATION = {
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  maxSizeBytes: 10 * 1024 * 1024,              // 10 MB
  compressionThresholdBytes: 2 * 1024 * 1024,  // 2 MB
  compressionQuality: 0.8,
};
```


---

## 8. Async Processing

### Una Sola Cola BullMQ: whatsapp-outbound

En Fase 1, BullMQ se usa **únicamente** para la cola `whatsapp-outbound`. Todas las demás operaciones que en diseños anteriores tenían cola propia ahora se procesan de forma más simple:

| Operación | Solución en Fase 1 |
|-----------|-------------------|
| Generación de PDFs | `@react-pdf/renderer` síncrono en el request-response cycle |
| Compresión de imágenes | `sharp` síncrono + streaming en el request (no bloquea event loop) |
| Alertas de entrega | `@nestjs/schedule` con `@Cron` cada 30 minutos |
| Notificaciones internas | WebSocket directo desde el use case via `NotificationPort` |
| File cleanup (logo) | Operación directa al subir el nuevo logo |

```typescript
// infrastructure/queue/queue.config.ts
export const QUEUES = {
  WHATSAPP_OUTBOUND: 'whatsapp-outbound',
} as const;
```

Redis es necesario para: **BullMQ** (`whatsapp-outbound`) + **caché de configuración de Tenant y permisos de Role** (TTL 5 min).

### Worker — whatsapp-outbound

```typescript
// infrastructure/queue/workers/whatsapp-outbound.worker.ts
const DEFAULT_JOB_OPTIONS: DefaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 30_000 }, // 30s → 60s → 120s
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};
```

El worker llama a `WhatsAppCloudAdapter.sendMessage()`. Si falla 3 veces, registra el fallo en el log de la `WhatsAppSession` con estado `FAILED`.

### Cron — DeliveryAlertsScheduler

```typescript
// infrastructure/scheduler/delivery-alerts.scheduler.ts
@Injectable()
export class DeliveryAlertsScheduler {
  constructor(
    private readonly workOrderRepo: WorkOrderRepository,
    private readonly notificationPort: NotificationPort,
    private readonly messagingPort: MessagingPort,
  ) {}

  @Cron('*/30 * * * *')  // Cada 30 minutos
  async checkDeliveryDeadlines(): Promise<void> {
    const threshold = new Date(Date.now() + 2 * 60 * 60 * 1000); // +2 horas
    const overdueOrders = await this.workOrderRepo.findNearingDeadline(threshold);

    await Promise.allSettled(
      overdueOrders.map(async (wo) => {
        await this.messagingPort.sendDeliveryAlertToCustomer(wo);
        await this.notificationPort.notifyAdmins(wo.tenantId, {
          type: 'DELIVERY_DEADLINE_NEAR',
          workOrderId: wo.id,
          promisedDeliveryAt: wo.promisedDeliveryAt,
        });
      }),
    );
  }
}
```


---

## 9. Real-Time Notifications — WebSocket Gateway

```typescript
// presentation/websocket/notifications.gateway.ts
@WebSocketGateway({ cors: true, namespace: '/notifications' })
export class NotificationsGateway implements NotificationPort {
  @WebSocketServer() server: Server;

  handleConnection(client: Socket): void {
    const { userId, tenantId } = this.extractFromToken(client.handshake.auth.token);
    client.join(`user:${userId}`);
    client.join(`tenant:${tenantId}`);
    this.sendPendingNotifications(client, userId);
  }

  async notifyUser(userId: string, notification: NotificationDto): Promise<void> {
    this.server.to(`user:${userId}`).emit('notification', notification);
  }

  async notifyAdmins(tenantId: string, payload: unknown): Promise<void> {
    this.server.to(`tenant:${tenantId}`).emit('notification', payload);
  }
}
```

**Limitación de escalabilidad documentada**: el `NotificationsGateway` usa la instancia de Socket.IO en memoria. Si se despliegan múltiples instancias del backend, las notificaciones solo llegan a usuarios conectados a la misma instancia. Solución en Fase 2: Redis adapter para Socket.IO (`@socket.io/redis-adapter`). Para Fase 1 con una sola instancia, esto no es un problema.

---

## 10. PDF Generation — @react-pdf/renderer Síncrono

Las cotizaciones se generan de forma **síncrona** en el request-response cycle usando `@react-pdf/renderer`. No hay cola BullMQ, no hay Puppeteer.

```
1. POST /api/quotes (o PUT /api/quotes/:id)
2. → Use case genera el PDF en memoria con @react-pdf/renderer
3. → Sube el PDF a R2: /{tenant_id}/{branch_id}/quotes/{quote_id}/v{version}/quote.pdf
4. → Guarda quote.pdfR2Key en base de datos
5. → Retorna URL pre-firmada 24h en la respuesta HTTP
```

```typescript
// infrastructure/pdf/react-pdf.adapter.ts
import { renderToBuffer } from '@react-pdf/renderer';
import { QuotePdfTemplate } from './templates/quote-pdf.template';

@Injectable()
export class ReactPdfAdapter implements PdfGeneratorPort {
  async generateQuotePdf(data: QuotePdfData): Promise<Buffer> {
    // Síncrono — renderToBuffer retorna una Promise que se resuelve rápido
    // para documentos de tamaño típico de cotización (< 1s)
    return renderToBuffer(<QuotePdfTemplate data={data} />);
  }
}
```

El tiempo de generación esperado para una cotización típica es < 500ms. Si en algún caso supera 2s, el timeout del endpoint protege al usuario. Para documentos complejos (Fase 2), se puede mover a BullMQ sin cambiar la interfaz `PdfGeneratorPort`.

---

## 11. Frontend Design

### State Management

- **Server State**: React Query (TanStack Query) — caché automático, refetch on focus, invalidación granular.
- **Client State**: Zustand — usuario activo, branch seleccionada, notificaciones no leídas.
- **Form State**: React Hook Form + Zod.

### Páginas Principales

#### Dashboard (`/`)
- Un solo fetch a `GET /api/dashboard/summary` que retorna todo.
- Polling cada 60 segundos via `refetchInterval` de React Query.
- Selector de Branch para OWNER con acceso multi-sucursal.
- Date range picker para filtros.

#### Work Orders (`/work-orders`)
- Tabla con filtros por estado, técnico y fecha (sin vista Kanban).
- Drawer lateral para detalle de WorkOrder.
- Upload de fotos drag & drop.
- Cambio de estado inline con confirmación modal.

#### Service Catalog (`/service-catalog`) ← NUEVO
- Tabla de items con filtro por `serviceType` y búsqueda por nombre.
- CRUD completo con modal.
- Autocompletado integrado en el formulario de WorkOrderLine.

#### Messages (`/messages`)
- Lista de sesiones WhatsApp (inbox).
- Panel de conversación con historial.
- Input de respuesta manual.
- Badge de mensajes no leídos en sidebar.
- Indicador "IA respondiendo" cuando RouterAgent está activo.

#### Inventory (`/inventory`)
- Tabla de Parts con SKU, nombre, `stock_disponible`, alertas.
- Modal para movimientos de stock (entrada / salida / ajuste / transferencia).

### Mobile Responsiveness

Resolución mínima soportada: **375px** (iPhone SE). Breakpoints Tailwind:
- `sm`: 375px — navegación colapsada, cards apiladas.
- `md`: 768px — sidebar visible, tablas con scroll horizontal.
- `lg`: 1024px — layout completo de escritorio.


---

## 12. Error Handling

### Jerarquía de Excepciones de Dominio

```typescript
// domain/exceptions/domain.exception.ts
export class DomainException extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 422,
  ) {
    super(message);
  }
}

export class WorkOrderInvalidTransitionException extends DomainException {
  constructor(from: WorkOrderStatus, to: WorkOrderStatus) {
    super(
      `Transición inválida: ${from} → ${to}`,
      'WORK_ORDER_INVALID_TRANSITION',
      422,
    );
  }
}

export class InsufficientStockException extends DomainException {
  constructor(partId: string, requested: number, available: number) {
    super(
      `Stock insuficiente. Solicitado: ${requested}, disponible: ${available}`,
      'INSUFFICIENT_STOCK',
      409,
    );
  }
}

export class VehicleHasActiveOrderException extends DomainException {
  constructor(vehicleId: string) {
    super(
      'El vehículo tiene una orden de trabajo activa. Debe completarla o cancelarla antes de crear una nueva.',
      'VEHICLE_HAS_ACTIVE_ORDER',
      409,
    );
  }
}
```

### Formato de Respuesta de Error HTTP

```typescript
interface ErrorResponse {
  statusCode: number;
  code: string;       // Semántico: 'INSUFFICIENT_STOCK', etc.
  message: string;    // En español, legible por el usuario
  traceId: string;    // Para correlacionar con Sentry
  timestamp: string;
}
```

---

## 13. Performance Design

### findById vs findByIdWithDetails

El `WorkOrderRepository` expone dos métodos con propósitos distintos:

- `findById(id, tenantId)`: sin includes — para listados y operaciones simples. Rápido.
- `findByIdWithDetails(id, tenantId)`: con `lines + parts + statusHistory + photoEvidences` — solo para el endpoint `GET /api/work-orders/:id`.

Los use cases de transición de estado, adición de líneas, etc., usan `findById`. Evitar `findByIdWithDetails` en paths de escritura reduce latencia y carga en la base de datos.

### Dashboard Consolidado

El use case `GetDashboardSummaryUseCase` ejecuta todas las queries en paralelo:

```typescript
// application/use-cases/dashboard/get-dashboard-summary.use-case.ts
@Injectable()
export class GetDashboardSummaryUseCase {
  async execute(input: DashboardInput): Promise<DashboardSummaryDto> {
    const [
      activeByStatus,
      todayRevenue,
      monthRevenue,
      avgCycleTime,
      lowStockAlerts,
      nearingDeadline,
      technicianRanking,
      incomeTrend,
      topParts,
      waitingPartsCount,
    ] = await Promise.all([
      this.workOrderRepo.countActiveByStatus(input.branchId, input.tenantId),
      this.paymentRepo.sumToday(input.branchId, input.tenantId),
      this.paymentRepo.sumMonth(input.branchId, input.tenantId, input.from, input.to),
      this.workOrderRepo.avgCycleTime(input.branchId, input.tenantId, input.from, input.to),
      this.partStockRepo.findLowStock(input.branchId, input.tenantId),
      this.workOrderRepo.findNearingDeadline(new Date(Date.now() + 2 * 3600_000), input.branchId, input.tenantId),
      this.workOrderRepo.technicianRanking(input.branchId, input.tenantId, input.from, input.to, 5),
      this.paymentRepo.incomeTrend(input.branchId, input.tenantId, 30),
      this.stockEntryRepo.topPartsByRotation(input.branchId, input.tenantId, input.from, input.to, 10),
      this.workOrderRepo.countByStatus(WorkOrderStatus.WAITING_PARTS, input.branchId, input.tenantId),
    ]);

    return { activeByStatus, todayRevenue, monthRevenue, avgCycleTime, lowStockAlerts,
             nearingDeadline, technicianRanking, incomeTrend, topParts,
             waitingPartsAlert: waitingPartsCount > 5 };
  }
}
```

### Paginación — Offset exclusivamente

Todos los listados usan `page` (1-indexed) y `pageSize`. Sin cursor-based pagination en Fase 1.

```typescript
interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
```

### Índices y Optimizaciones de Base de Datos

1. Índice compuesto: `work_orders(branch_id, status, deleted_at, created_at DESC)`.
2. Índice compuesto: `payments(tenant_id, paid_at DESC)`.
3. Columna generada `stock_disponible` en `part_branch_stocks` (evita cálculo en query).
4. Índice GIN en `customers.full_name` para búsqueda full-text.

### Slow Query Logging

```typescript
// prisma.service.ts
this.prisma.$on('query', (event) => {
  if (event.duration > 1000) {
    logger.warn({
      message: 'slow_query',
      query: event.query,
      durationMs: event.duration,
      traceId: AsyncLocalStorage.getStore()?.traceId,
    });
  }
});
```

### Caché Redis (TTL 5 min)

```typescript
const CACHE_KEYS = {
  tenantConfig:      (tenantId: string) => `tenant:${tenantId}:config`,
  rolePermissions:   (roleId: string)   => `role:${roleId}:permissions`,
  branchList:        (tenantId: string) => `tenant:${tenantId}:branches`,
};
```


---

## 14. Prisma Schema

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Tenant {
  id                    String    @id @default(uuid())
  name                  String
  taxId                 String    @unique
  logoUrl               String?
  vatPercentage         Decimal   @default(19.00)
  accountingPeriodStart Int       @default(1)
  businessHours         Json?
  termsAndConditions    String?
  whatsappToken         String?   // Almacenado cifrado con AES-256-GCM
  whatsappPhoneNumberId String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  branches              Branch[]
  users                 User[]
  roles                 Role[]
  customers             Customer[]
  parts                 Part[]
  serviceCatalog        ServiceCatalogItem[]
}

model WorkOrder {
  id                 String            @id @default(uuid())
  tenantId           String
  branchId           String
  orderNumber        String
  receptionId        String
  vehicleId          String
  customerId         String
  technicianId       String
  serviceType        String
  problemDescription String
  status             String            @default("PENDING")
  promisedDeliveryAt DateTime
  finalOdometer      Int?
  deletedAt          DateTime?
  createdAt          DateTime          @default(now())
  updatedAt          DateTime          @updatedAt
  tenant             Tenant            @relation(fields: [tenantId], references: [id])
  branch             Branch            @relation(fields: [branchId], references: [id])
  reception          VehicleReception  @relation(fields: [receptionId], references: [id])
  vehicle            Vehicle           @relation(fields: [vehicleId], references: [id])
  customer           Customer          @relation(fields: [customerId], references: [id])
  technician         User              @relation(fields: [technicianId], references: [id])
  lines              WorkOrderLine[]
  parts              WorkOrderPart[]
  statusHistory      WorkOrderStatusHistory[]
  photoEvidences     PhotoEvidence[]
  quotes             Quote[]
  payments           Payment[]

  @@unique([tenantId, orderNumber])
  @@index([tenantId, deletedAt])
  @@index([branchId, status, deletedAt, createdAt(sort: Desc)])
  @@index([customerId])
  @@index([vehicleId])
  @@index([technicianId])
  @@index([promisedDeliveryAt, status])
}

model WorkOrderLine {
  id               String     @id @default(uuid())
  workOrderId      String
  description      String
  estimatedHours   Decimal
  unitPrice        Decimal
  technicianId     String
  serviceCatalogId String?    // null = texto libre; string = precargado del catálogo
  createdAt        DateTime   @default(now())
  workOrder        WorkOrder  @relation(fields: [workOrderId], references: [id])
  technician       User       @relation(fields: [technicianId], references: [id])
  catalogItem      ServiceCatalogItem? @relation(fields: [serviceCatalogId], references: [id])
}

model PartBranchStock {
  id             String   @id @default(uuid())
  partId         String
  branchId       String
  stockFisico    Decimal  @default(0)
  stockReservado Decimal  @default(0)
  updatedAt      DateTime @updatedAt
  part           Part     @relation(fields: [partId], references: [id])
  branch         Branch   @relation(fields: [branchId], references: [id])

  @@unique([partId, branchId])
  @@index([branchId])
}

model ServiceCatalogItem {
  id             String          @id @default(uuid())
  tenantId       String
  name           String
  description    String?
  estimatedHours Decimal
  suggestedPrice Decimal
  serviceType    String
  isActive       Boolean         @default(true)
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  tenant         Tenant          @relation(fields: [tenantId], references: [id])
  workOrderLines WorkOrderLine[]

  @@index([tenantId, isActive])
  @@index([tenantId, serviceType])
}

// [Resto de modelos: Branch, User, Role, Permission, Customer, Vehicle,
//  VehicleReception, Part, StockEntry, Quote, Payment, PhotoEvidence,
//  WhatsAppSession, Message, Notification, AuditLog — siguiendo el mismo patrón]
```

**Nota sobre `commerce.module.ts`**:

```typescript
// src/application/use-cases/commerce/commerce.module.ts
// TODO Fase 2: integración DIAN via InvoiceProvider port.
// En Fase 1 no existe abstracción InvoiceProvider — solo esta anotación.
@Module({ ... })
export class CommerceModule {}
```

---

## 15. Environment Variables

```bash
# Backend (NestJS)
# Autenticación — jsonwebtoken + bcrypt (sin @nestjs/passport, sin @nestjs/jwt)
JWT_SECRET=
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

DATABASE_URL=postgresql://user:pass@neon.tech/motoworkshop
REDIS_URL=redis://localhost:6379
CLOUDFLARE_R2_ACCOUNT_ID=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET_NAME=
CLOUDFLARE_R2_PUBLIC_URL=
META_WHATSAPP_TOKEN=
META_WHATSAPP_PHONE_NUMBER_ID=
META_WHATSAPP_WEBHOOK_VERIFY_TOKEN=
META_WHATSAPP_APP_SECRET=         # Para verificar firma HMAC-SHA256 del webhook
ENCRYPTION_KEY=                   # 32 bytes en hex (64 chars) — cifrado AES-256-GCM
DEEPSEEK_API_KEY=
GROQ_API_KEY=
JWT_SECRET=
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d
SENTRY_DSN=

# Frontend (Next.js)
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_WS_URL=
```

Generar `ENCRYPTION_KEY`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```


---

## 16. Testing Strategy

Para Fase 1 con un solo desarrollador, **Jest unit + integration tests son suficientes**. No se usa Playwright ni E2E automatizado en esta fase.

### Backend

| Tipo | Framework | Alcance |
|------|-----------|---------|
| Unit | Jest | Entidades de dominio, value objects, casos de uso (con mocks de repositorios) |
| Integration | Jest + Supertest | Controllers + base de datos (Neon dev branch) |
| E2E | Jest + Supertest | Flujos completos: recepción → WorkOrder → DELIVERED |

#### Ejemplo — Unit Test de dominio

```typescript
// domain/entities/work-order.entity.spec.ts
describe('WorkOrder.transitionTo', () => {
  it('lanza excepción en transición inválida DELIVERED → CANCELLED', () => {
    const wo = createWorkOrderFixture({ status: WorkOrderStatus.DELIVERED });
    expect(() => wo.transitionTo(WorkOrderStatus.CANCELLED))
      .toThrow(WorkOrderInvalidTransitionException);
  });

  it('transiciona PENDING → IN_PROGRESS correctamente', () => {
    const wo = createWorkOrderFixture({ status: WorkOrderStatus.PENDING });
    const change = wo.transitionTo(WorkOrderStatus.IN_PROGRESS);
    expect(wo.status).toBe(WorkOrderStatus.IN_PROGRESS);
    expect(change.previousStatus).toBe(WorkOrderStatus.PENDING);
  });
});
```

#### Ejemplo — Unit Test de inventario

```typescript
// domain/entities/part-branch-stock.entity.spec.ts
describe('PartBranchStock.reserve', () => {
  it('lanza InsufficientStockException cuando disponible < solicitado', () => {
    const stock = new PartBranchStock('id', 'part-1', 'branch-1', 5, 3);
    // stockDisponible = 5 - 3 = 2
    expect(() => stock.reserve(3)).toThrow(InsufficientStockException);
  });

  it('incrementa stockReservado cuando hay stock suficiente', () => {
    const stock = new PartBranchStock('id', 'part-1', 'branch-1', 10, 0);
    stock.reserve(4);
    expect(stock.stockReservado).toBe(4);
    expect(stock.stockDisponible).toBe(6);
  });
});
```

#### Ejemplo — Unit Test de ToolExecutor (stateless)

```typescript
// infrastructure/ai/tool-executor.spec.ts
describe('ToolExecutor.execute', () => {
  it('lanza ToolLimitExceededException cuando callCount >= 5', async () => {
    const executor = new ToolExecutor(mockRegistry, mockLogger);
    const context = { sessionId: 's1', messageId: 'm1', callCount: 5 };
    await expect(executor.execute('getWorkOrderStatus', {}, context))
      .rejects.toThrow(ToolLimitExceededException);
  });

  it('ejecuta la tool cuando callCount < 5', async () => {
    const executor = new ToolExecutor(mockRegistry, mockLogger);
    const context = { sessionId: 's1', messageId: 'm1', callCount: 0 };
    await expect(executor.execute('getWorkOrderStatus', { workOrderId: 'wo-1' }, context))
      .resolves.toBeDefined();
  });
});
```

### Frontend

| Tipo | Framework | Alcance |
|------|-----------|---------|
| Unit | Vitest | Hooks, utilidades, lógica de formularios |
| Component | Testing Library | Componentes clave (WorkOrderStatusBadge, StockAlert) |

No se implementan tests E2E con Playwright en Fase 1. Los flujos críticos se cubren con tests de integración en el backend (Jest + Supertest) que ejercitan el stack completo.

---

## 17. Deployment

### Docker Compose (Desarrollo)

```yaml
services:
  api:
    build: ./apps/api
    ports: ["3001:3001"]
    environment:
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: redis://redis:6379
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
    depends_on: [redis]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes: ["redis_data:/data"]

volumes:
  redis_data:
```

### Producción

```
Frontend:  Cloudflare Pages (auto-deploy desde main branch via Git integration)
Backend:   Docker container (VPS o managed container service)
Database:  Neon PostgreSQL (managed — branch main para prod, dev para desarrollo)
Redis:     Upstash Redis (managed serverless) o Redis Cloud
R2:        Cloudflare R2 (managed)
```

### CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [main]

jobs:
  test:
    steps:
      - run: npm run test:ci
      - run: npm run type-check

  migrate:
    needs: test
    steps:
      - run: npx prisma migrate deploy

  deploy-api:
    needs: migrate
    steps:
      - run: docker build & push
      - run: deploy to container service

  deploy-web:
    needs: test
    # Cloudflare Pages auto-deploy via Git integration
```

---

*Última actualización: Fase 1 MVP — equipo de un desarrollador.*
*Fase 2 agregará: InvoiceProvider (DIAN), Redis adapter para Socket.IO, agentes especializados (CommercialAgent, WorkshopAgent), previous_data en AuditLog, y cursor-based pagination para listados de alto volumen.*
