# Architecture — MotoWorkshop SaaS

---

## Stack Tecnológico

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| Frontend | Next.js 14 + TypeScript | SSR/SSG, App Router, despliegue en Cloudflare Pages |
| UI | TailwindCSS + shadcn/ui | Componentes accesibles, diseño consistente, mobile-first |
| Backend | NestJS + TypeScript | Módulos, DI nativa, decoradores, ideal para Clean Architecture |
| Base de datos | PostgreSQL (Neon) | Serverless, branching para dev/staging/prod, fully managed |
| ORM | Prisma | Type-safety, migraciones, query builder tipado |
| Storage | Cloudflare R2 | S3-compatible, sin egress fees, compatible con Workers |
| Colas | BullMQ + Redis | Procesamiento asíncrono de WhatsApp, PDFs, imágenes |
| Caché | Redis | TTL 5min para config de Tenant, sesiones, rate limiting |
| Observabilidad | Sentry | Excepciones frontend/backend, performance, alertas |
| Contenedores | Docker | Backend NestJS + Redis en contenedores |
| WhatsApp | Meta WhatsApp Cloud API | Canal oficial, webhooks, plantillas aprobadas |
| LLM primario | DeepSeek | Coste/rendimiento para español latinoamericano |
| LLM secundario | Groq | Fallback de baja latencia |
| Despliegue frontend | Cloudflare Pages | Edge, CDN global, CI/CD integrado |

---

## Arquitectura de Alto Nivel

```
┌─────────────────────────────────────────────────────────────────┐
│                        INTERNET                                 │
└──────────────┬──────────────────────────────┬───────────────────┘
               │                              │
       ┌───────▼────────┐           ┌─────────▼──────────┐
       │  Cloudflare    │           │  Meta WhatsApp     │
       │  Pages         │           │  Cloud API         │
       │  (Next.js)     │           │  (Webhooks)        │
       └───────┬────────┘           └─────────┬──────────┘
               │  HTTPS                       │  HTTPS
       ┌───────▼──────────────────────────────▼──────────┐
       │              NestJS Backend (Docker)             │
       │                                                  │
       │  ┌────────────┐  ┌────────────┐  ┌───────────┐  │
       │  │Presentation│  │Application │  │  Domain   │  │
       │  │(Controllers│→ │(Use Cases) │→ │(Entities, │  │
       │  │ Guards)    │  │            │  │ Repos IF) │  │
       │  └────────────┘  └────────────┘  └───────────┘  │
       │                                        ↑         │
       │  ┌─────────────────────────────────────┘         │
       │  │         Infrastructure                        │
       │  │  Prisma │ R2 │ WhatsApp │ BullMQ │ Redis │ AI │
       │  └──────────────────────────────────────────────┘│
       └──────────┬──────────────────────────────┬────────┘
                  │                              │
         ┌────────▼────────┐          ┌──────────▼──────┐
         │  PostgreSQL      │          │  Cloudflare R2  │
         │  (Neon)          │          │  (Archivos)     │
         └─────────────────┘          └─────────────────┘
                  │
         ┌────────▼────────┐
         │  Redis           │
         │  (Caché + Colas) │
         └─────────────────┘
```

---

## Estructura de Capas (Clean Architecture)

### Regla de Dependencia

```
presentation → application → domain
infrastructure → domain (implementa interfaces)
```

Ninguna capa interna conoce las capas externas. El dominio no importa nada fuera de sí mismo.

### Estructura de directorios — Backend NestJS

```
src/
├── domain/
│   ├── entities/           # Entidades de dominio (clases con lógica)
│   ├── value-objects/      # Objetos de valor inmutables
│   ├── repositories/       # Interfaces de repositorio (contratos)
│   ├── events/             # Eventos de dominio
│   └── exceptions/         # Excepciones de dominio tipadas
│
├── application/
│   ├── use-cases/          # Casos de uso (un archivo por caso de uso)
│   ├── dtos/               # DTOs de entrada/salida para casos de uso
│   └── ports/              # Interfaces de servicios externos (puertos)
│
├── infrastructure/
│   ├── persistence/        # Implementaciones Prisma de repositorios
│   ├── storage/            # Cloudflare R2 adapter
│   ├── messaging/          # Meta WhatsApp Cloud API adapter
│   ├── ai/                 # DeepSeek / Groq adapters + Tools
│   ├── queue/              # BullMQ workers y producers
│   ├── cache/              # Redis adapter
│   └── observability/      # Sentry integration
│
└── presentation/
    ├── http/               # Controllers NestJS
    │   ├── guards/         # JWT Guard, Tenant Guard, Permission Guard
    │   ├── decorators/     # @CurrentUser, @RequirePermission
    │   └── interceptors/   # TraceId, ResponseTransform
    └── websocket/          # Gateway para notificaciones en tiempo real
```

---

## Módulos NestJS

Cada Bounded Context se implementa como un módulo NestJS independiente:

```
AppModule
├── IdentityModule        (Tenant, Branch, User, Role, Permission)
├── CustomerModule        (Customer, Vehicle, VehicleOwnership)
├── WorkshopModule        (VehicleReception, WorkOrder, WorkOrderLine, WorkOrderPart)
├── InventoryModule       (Part, PartBranchStock, StockEntry, StockTransfer)
├── CommerceModule        (Quote, Payment)
├── StorageModule         (Cloudflare R2 — shared)
├── MessagingModule       (WhatsApp — WhatsAppSession, Message)
├── AIModule              (AIAgent Router, Tools, LLM adapters)
├── NotificationModule    (Notificaciones internas — WebSocket)
├── DashboardModule       (Métricas y reportes)
└── AuditModule           (Log de auditoría)
```

---

## Patrón Multi-Tenant

### Aislamiento por tenant_id

Cada entidad persistida incluye `tenant_id`. El aislamiento se garantiza en tres capas:

1. **Guard de autenticación**: el JWT incluye `tenantId` y `branchId` del usuario.
2. **Repositorios**: cada query incluye `WHERE tenant_id = $tenantId` obligatoriamente mediante un `TenantScope` aplicado en la capa de infraestructura.
3. **Respuesta 403**: si una entidad existe pero pertenece a otro tenant, se retorna 403 sin revelar la existencia del recurso.

```typescript
// Ejemplo de TenantScope en repositorio Prisma
async findById(id: string, tenantId: string): Promise<WorkOrder | null> {
  return this.prisma.workOrder.findFirst({
    where: { id, tenantId, deletedAt: null }
  });
}
```

---

## Patrón de Inventario — Tres Niveles de Stock

Las operaciones sobre stock siguen este flujo:

```
Agregar Part a WorkOrder
  → Verificar stock_disponible >= cantidad
  → Si OK: incrementar stock_reservado (StockEntry tipo RESERVA)
  → stock_disponible se recalcula automáticamente

WorkOrder → DELIVERED
  → Decrementar stock_fisico (StockEntry tipo SALIDA)
  → Decrementar stock_reservado (StockEntry tipo LIBERACION)

WorkOrder → CANCELLED
  → Solo decrementar stock_reservado (StockEntry tipo LIBERACION)
  → stock_fisico no cambia
```

---

## Patrón de Precios Históricos

```typescript
// WorkOrderPart almacena el precio al momento de creación
interface WorkOrderPart {
  partId: string;
  quantity: number;
  unitPriceAtSale: number; // Congelado — nunca se actualiza
}
```

Los cambios en `Part.salePrice` no afectan `WorkOrderPart.unitPriceAtSale` existentes.

---

## Flujo de Agente de IA (Fase 1 — Router)

```
Mensaje WhatsApp entrante
  → WhatsApp webhook → MessagingModule
  → ¿Recepcionista respondió en últimos 5 min? → No → AIModule
  → ¿Número registrado como Customer?
      → Sí: puede usar todas las Tools
      → No: solo Tool getBusinessInformation
  → RouterAgent clasifica intención
  → Selecciona Tool correspondiente
  → Tool valida schema → invoca UseCase → retorna resultado
  → RouterAgent genera respuesta en idioma del mensaje
  → Envía respuesta por WhatsApp
```

**Fallback de LLM:**
```
DeepSeek (timeout 10s)
  → Si falla: Groq (timeout 10s)
  → Si falla: mensaje predefinido + notificar recepcionista
```

**Límite de Tools por mensaje:** 5 invocaciones máximo. Si se supera → escalar a humano.

---

## Gestión de Archivos en Cloudflare R2

### Estructura de rutas
```
/{tenant_id}/{branch_id}/work-orders/{work_order_id}/evidences/{filename}
/{tenant_id}/{branch_id}/receptions/{reception_id}/photos/{filename}
/{tenant_id}/{branch_id}/quotes/{quote_id}/v{version}/{filename}
/{tenant_id}/logos/{filename}
```

### Política de URLs pre-firmadas
- **Todos los tipos de archivo**: 24 horas de expiración. Sin excepciones.
- La verificación de permisos se hace **antes** de generar la URL pre-firmada.

### Política de eliminación
- Los archivos **no se eliminan físicamente** cuando su recurso padre recibe soft delete.
- La única excepción es el reemplazo del logo del Tenant al actualizarlo.

### Procesamiento asíncrono (BullMQ)
```
Cola: file-upload
  → Compresión de imágenes > 2MB
  → PNG → conversión a WebP antes de comprimir
  → JPEG/WebP → compresión a calidad mínima 80%
  → Reintento hasta 3 veces si falla la subida

Cola: file-cleanup
  → Reemplazo de logo del Tenant (único caso de reemplazo físico)
```

---

## Procesamiento Asíncrono — BullMQ Queues

| Cola | Trabajos | Descripción |
|------|---------|-------------|
| `whatsapp-outbound` | SendMessage, SendQuoteUrl | Envío de mensajes WhatsApp con reintentos |
| `pdf-generation` | GenerateQuotePdf | Generación de PDFs de cotizaciones |
| `file-upload` | CompressAndUpload | Compresión y subida de imágenes |
| `file-cleanup` | DeleteLogoFile | Reemplazo físico de logo del Tenant |
| `notifications` | DeliverNotification | Entrega de notificaciones internas |
| `delivery-alerts` | CheckDeliveryDeadlines | Job cada 30 min para alertas de entrega |

---

## Autenticación y Seguridad

- **JWT**: payload incluye `userId`, `tenantId`, `branchId`, `roleId`, `permissions[]`.
- **Refresh token**: rotación en cada uso, almacenado hasheado en base de datos.
- **Guards en orden**: JwtAuthGuard → TenantGuard → PermissionGuard.
- **Rate limiting**: Redis-backed, por IP y por usuario.
- **Audit log**: cada escritura genera un registro inmutable en la tabla `AuditLog`.

---

## Observabilidad

- **Sentry**: excepciones, performance, integraciones externas.
- **trace_id**: UUID v4 generado en el interceptor de entrada, propagado en headers y logs.
- **Logs estructurados**: JSON con campos `timestamp`, `level`, `trace_id`, `tenant_id`, `message`, `metadata`.
- **Slow queries**: queries > 1000ms se logean con texto completo y parámetros.
- **Health check**: `GET /api/health` verifica PostgreSQL, R2, Redis, BullMQ y Meta WhatsApp API.

---

## Decisiones Arquitectónicas (ADRs)

### ADR-001: BullMQ sobre procesamiento síncrono para WhatsApp y PDFs
**Decisión**: Todas las operaciones de envío WhatsApp, generación PDF y compresión de imágenes son asíncronas via BullMQ.
**Razón**: La respuesta HTTP al usuario no debe esperar por servicios externos. La resiliencia se garantiza con colas persistentes en Redis.

### ADR-002: Soft delete con archivos R2 conservados
**Decisión**: El soft delete nunca elimina archivos físicos de R2.
**Razón**: Las evidencias fotográficas y documentos son registros legales. La eliminación física podría destruir evidencia de disputas con clientes.

### ADR-003: Precio histórico inmutable en WorkOrderPart
**Decisión**: `unitPriceAtSale` se graba al momento de agregar el Part y nunca se actualiza.
**Razón**: Los estados financieros históricos deben ser inmutables. Una orden cerrada hace 6 meses no puede cambiar su valor por una actualización de precios.

### ADR-004: Un único agente Router en Fase 1
**Decisión**: No se implementan agentes especializados en Fase 1.
**Razón**: Reducir complejidad inicial. El Router con 6 Tools cubre los casos de uso de atención al cliente. Los agentes especializados se agregan en Fase 2 sin modificar la arquitectura de Tools.

### ADR-005: InvoiceProvider como abstracción vacía
**Decisión**: La interfaz `InvoiceProvider` se define en la capa de infraestructura pero no se implementa.
**Razón**: La integración DIAN requiere certificados, resoluciones y proceso de habilitación. Preparar la abstracción evita refactoring cuando esté listo.
