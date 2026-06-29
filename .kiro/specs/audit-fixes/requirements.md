# Audit Fixes — Requirements

> Producto del reporte de auditoría realizado el 2026-06-28.
> Ningún ítem puede quedar fuera. Cada uno tiene referencia exacta al archivo y línea auditados.

---

## Contexto del proyecto

Monorepo pnpm con tres apps:

- `apps/api` — NestJS + Prisma (backend)
- `apps/web` — Next.js 15 App Router (frontend)
- `apps/agents` — FastAPI + LangGraph (microservicio Python)

---

## FASE 1 — Seguridad crítica

### F1-1: CORS abierto en producción

**Archivo**: `apps/api/src/main.ts`
**Línea**: 11

`app.enableCors()` sin opciones acepta cualquier origin.
Debe leer la variable de entorno `ALLOWED_ORIGINS` (lista separada por coma) y restringir a esos dominios.
Si la variable no existe, mantener comportamiento permisivo solo en desarrollo (`NODE_ENV !== 'production'`).

### F1-2: JWT secret con fallback silencioso

**Archivo**: `apps/api/src/infrastructure/auth/jwt.service.ts`
**Líneas**: 11-12

Si `JWT_SECRET` no está en el entorno y `NODE_ENV === 'production'`, lanzar un `Error` con el mensaje `"JWT_SECRET is required in production"` antes de arrancar. En desarrollo, el fallback actual está bien pero debe emitir un `console.warn`.

### F1-3: Encryption key con fallback silencioso

**Archivo**: `apps/api/src/infrastructure/crypto/field-encryption.service.ts`
**Líneas**: 10-16

Igual que F1-2: lanzar `Error` en producción si `ENCRYPTION_KEY` no está configurado. En desarrollo, mantener el fallback pero emitir `console.warn`.

### F1-4: Endpoint de creación de tenant sin autenticación ni rate limit

**Archivo**: `apps/api/src/presentation/http/controllers/tenants.controller.ts`
**Líneas**: 17-20

El `@Post()` no tiene `@UseGuards` ni `@Throttle`. Agregar `@UseGuards(ThrottlerGuard)` y `@Throttle({ default: { limit: 3, ttl: 300000 } })` para limitar a 3 registros por 5 minutos por IP.

### F1-5: `/auth/refresh` sin rate limit

**Archivo**: `apps/api/src/presentation/http/controllers/auth.controller.ts`
**Líneas**: 42-45

El endpoint `@Post('refresh')` no tiene `@UseGuards(ThrottlerGuard)`. Agregar limitador: `@Throttle({ default: { limit: 10, ttl: 60000 } })` (10 intentos por minuto).

### F1-6: Rate limiting global no aplicado

**Archivo**: `apps/api/src/app.module.ts`

`ThrottlerModule.forRoot` está registrado pero no hay `APP_GUARD` global. Agregar en el array de `providers` de `AppModule`:

```ts
{ provide: APP_GUARD, useClass: ThrottlerGuard }
```

E importar `ThrottlerGuard` desde `@nestjs/throttler`.
Ajustar el default global a `{ ttl: 60000, limit: 60 }` (60 req/min por IP, razonable para uso normal). El login mantiene su propio `@Throttle` más restrictivo.

### F1-7: Race condition en generación de número de orden

**Archivo**: `apps/api/src/infrastructure/persistence/prisma/repositories/work-order.prisma-repository.ts`
**Líneas**: 398-404

El método `generateOrderNumber` cuenta registros existentes para calcular el siguiente número. Bajo concurrencia, dos transacciones pueden leer el mismo `count` y generar números duplicados.

Solución: envolver la lógica en una transacción serializable o usar `$queryRaw` con `SELECT ... FOR UPDATE`. La implementación más práctica con Prisma:

```ts
async generateOrderNumber(tenantId: string, year: number): Promise<string> {
  const prefix = `WO-${year}-`;
  // Usar un contador atómico con rawQuery para evitar duplicados bajo concurrencia
  const result = await this.prisma.$queryRaw<[{ nextval: bigint }]>`
    SELECT COALESCE(MAX(CAST(SUBSTRING("orderNumber" FROM LENGTH(${prefix}) + 1) AS INTEGER)), 0) + 1 AS nextval
    FROM "work_orders"
    WHERE "tenantId" = ${tenantId}
      AND "orderNumber" LIKE ${prefix + '%'}
  `;
  const next = Number(result[0].nextval).toString().padStart(6, '0');
  return `${prefix}${next}`;
}
```

Adicionalmente, agregar en el schema Prisma un índice único en `orderNumber` + `tenantId` como última línea de defensa.

### F1-8: Permission cache in-memory no compartido entre réplicas

**Archivo**: `apps/api/src/presentation/http/guards/permission.guard.ts`

El `Map` privado de caché no se comparte entre instancias.
Solución aceptable para el estado actual (no hay Redis configurado en el guard): reducir el TTL del caché a 30 segundos (`TTL_MS = 30 * 1000`) para acotar el impacto. Agregar un comentario que documente la limitación y recomiende migrarlo a Redis cuando haya múltiples réplicas.

---

## FASE 2 — Rendimiento y UX

### F2-1: `useTeam` invocado dos veces en el mismo árbol de componentes

**Archivo**: `apps/web/src/app/(dashboard)/work-orders/[id]/page.tsx`
**Líneas**: 72 y 522

`WorkOrderDetailPage` (línea 72) y `ServiceLinesSection` (línea 522) llaman a `useTeam()` independientemente, generando **4 peticiones HTTP** (`/api/users` × 2, `/api/roles` × 2) cuando la página carga.

Solución:

1. Llamar `useTeam()` **solo en `WorkOrderDetailPage`** (línea 72).
2. Pasar `technicians` y `nameOf` como props a `ServiceLinesSection`.
3. Actualizar la interfaz de props de `ServiceLinesSection` para recibir `technicians: TeamMember[]` y `nameOf: (id: string | null | undefined) => string`.
4. Eliminar la llamada a `useTeam()` dentro de `ServiceLinesSection`.

### F2-2: Logo del tenant se re-fetches en cada navegación

**Archivo**: `apps/web/src/components/dashboard-shell.tsx`
**Líneas**: 106-113

El `useEffect` en el componente `Brand` tiene `pathname` en su dependency array, haciendo que el logo se recargue en **cada cambio de ruta**. El logo no cambia según la ruta.

Solución: eliminar `pathname` del dependency array y del `useEffect`. El logo solo debe cargarse una vez al montar el componente.

```tsx
// ANTES
useEffect(() => {
  setLoading(true);
  setLogoError(false);
  apiGet<{ url: string | null }>('/api/settings/logo')
    .then(({ url }) => setLogoUrl(url))
    .catch(() => setLogoUrl(null))
    .finally(() => setLoading(false));
}, [pathname]); // ← ELIMINAR pathname

// DESPUÉS
useEffect(() => {
  setLoading(true);
  setLogoError(false);
  apiGet<{ url: string | null }>('/api/settings/logo')
    .then(({ url }) => setLogoUrl(url))
    .catch(() => setLogoUrl(null))
    .finally(() => setLoading(false));
}, []); // ← solo al montar
```

También eliminar `const pathname = usePathname()` de `Brand` si no se usa para nada más en ese componente.

### F2-3: `window.prompt()` nativo para odómetro final

**Archivo**: `apps/web/src/app/(dashboard)/work-orders/[id]/page.tsx`
**Líneas**: 411-416 (dentro de `TransitionButton`)

`window.prompt()` es bloqueante, no funciona con `runtime = 'edge'`, sin accesibilidad y sin validación. El proyecto ya tiene un componente `Modal` en `@/components/ui/modal`.

Solución: cuando `next === 'COMPLETED'`, en lugar de llamar `window.prompt`, mostrar un pequeño inline form dentro de la tarjeta (o usar el Modal existente) con un `<Input type="number">` para el odómetro y botones "Confirmar / Cancelar". El `TransitionButton` debe recibir un callback y el estado del modal debe manejarse en `WorkOrderDetailPage`.

### F2-4: `useEffect(() => load(), [load])` retorna el resultado de `load()`

**Archivos**:

- `apps/web/src/app/(dashboard)/work-orders/[id]/page.tsx` líneas 903-908 (`QuotesSection`) y 1017-1022 (`PaymentsSection`)

`useEffect` espera que su callback retorne `undefined` o una función cleanup, pero `load()` retorna `Promise<void>`. Cambiar a:

```ts
useEffect(() => {
  void load();
}, [load]);
```

### F2-5: Validación de fechas desde query params

**Archivo**: `apps/api/src/presentation/http/controllers/work-orders.controller.ts`
**Líneas**: 96-97

`from: from ? new Date(from) : undefined` no valida que la fecha sea válida. Un string inválido resulta en `Invalid Date` que llega a la base de datos.

Solución: validar antes de parsear:

```ts
const parseDate = (s?: string): Date | undefined => {
  if (!s) return undefined;
  const d = new Date(s);
  if (isNaN(d.getTime())) throw new BadRequestException(`Invalid date: ${s}`);
  return d;
};
```

Aplicar `parseDate` a `from` y `to` en el método `list`. Importar `BadRequestException` desde `@nestjs/common`.

---

## FASE 3 — Refactor estructural

### F3-1: Split del God File `work-orders/[id]/page.tsx`

**Archivo**: `apps/web/src/app/(dashboard)/work-orders/[id]/page.tsx` (1 073 líneas)

Extraer cada componente a un archivo propio dentro de un directorio `_components/` co-ubicado con la página (`apps/web/src/app/(dashboard)/work-orders/[id]/_components/`).

Componentes a extraer (uno por archivo):

1. `VehicleHistorySection` → `vehicle-history-section.tsx`
2. `ObservationsSection` → `observations-section.tsx`
3. `ServiceLinesSection` → `service-lines-section.tsx`
4. `PartsSection` → `parts-section.tsx`
5. `EvidencesSection` → `evidences-section.tsx`
6. `QuotesSection` → `quotes-section.tsx`
7. `PaymentsSection` → `payments-section.tsx`
8. `SectionCard` → `section-card.tsx` (shared dentro del mismo `_components/`)
9. `Meta` → `meta.tsx` (shared)
10. `TransitionButton` → `transition-button.tsx`

El archivo `page.tsx` resultante debe quedar bajo **150 líneas**, importando todos los sub-componentes.

El tipo `Run` y la función utilitaria `money` deben moverse a un archivo `_components/types.ts` o inline donde corresponda.

### F3-2: Split del God File `agents.use-cases.ts`

**Archivo**: `apps/api/src/application/use-cases/agents/agents.use-cases.ts` (321 líneas, 11 use-cases)

Cada use-case a su propio archivo dentro de `apps/api/src/application/use-cases/agents/`:

1. `list-active-tenants.use-case.ts` — `ListActiveTenantsUseCase`
2. `get-agents-dashboard-summary.use-case.ts` — `GetAgentsDashboardSummaryUseCase`
3. `get-agents-inventory-status.use-case.ts` — `GetAgentsInventoryStatusUseCase`
4. `create-purchase-order-draft.use-case.ts` — `CreatePurchaseOrderDraftUseCase`
5. `create-stock-alert.use-case.ts` — `CreateStockAlertUseCase`
6. `get-pending-work-orders.use-case.ts` — `GetPendingWorkOrdersUseCase`
7. `record-report.use-case.ts` — `RecordReportUseCase`
8. `generate-report.use-case.ts` — `GenerateReportUseCase`
9. `send-owner-whatsapp.use-case.ts` — `SendOwnerWhatsAppUseCase`
10. `list-reports.use-case.ts` — `ListReportsUseCase`
11. `get-report-download-url.use-case.ts` — `GetReportDownloadUrlUseCase`

Actualizar todos los imports en `apps/api/src/agents.module.ts` y cualquier otro archivo que importe desde `agents.use-cases.ts`.

El archivo `agents.use-cases.ts` original debe eliminarse (o convertirse en un barrel `index.ts` que re-exporte todo para compatibilidad).

### F3-3: Tipado del endpoint PUT `/tenants/me`

**Archivo**: `apps/api/src/presentation/http/controllers/tenants.controller.ts`
**Líneas**: 32-40

`@Body() body: Record<string, unknown>` no tiene validación de tipos. Crear un DTO:

```ts
// Nuevo archivo: apps/api/src/presentation/http/dtos/update-tenant-config.dto.ts
export class UpdateTenantConfigDto {
  name?: string;
  address?: string;
  phone?: string;
  businessHours?: Record<string, unknown>;
  whatsappPhone?: string;
}
```

Usar `@Body() body: UpdateTenantConfigDto` en el controller. Si el proyecto usa `class-validator`, agregar los decoradores apropiados (`@IsOptional`, `@IsString`, etc.).

### F3-4: Eliminar casts `as unknown as string[]` en repositorio de work-orders

**Archivo**: `apps/api/src/infrastructure/persistence/prisma/repositories/work-order.prisma-repository.ts`
**Líneas**: 238, 253, 338

El patrón `ACTIVE_STATUSES as unknown as string[]` indica un mismatch entre el tipo del dominio y lo que Prisma espera. Solución:

```ts
// En lugar de: status: { in: ACTIVE_STATUSES as unknown as string[] }
// Usar:
status: { in: [...ACTIVE_STATUSES] as string[] }
// O si ACTIVE_STATUSES ya es readonly string[]:
status: { in: ACTIVE_STATUSES as readonly string[] as string[] }
```

Verificar el tipo de `ACTIVE_STATUSES` en `work-order-status.vo.ts` y tiparlo como `readonly WorkOrderStatus[]`. El cast directo `as string[]` es más honesto que el doble `as unknown as`.

### F3-5: Botón de búsqueda global sin funcionalidad (código muerto)

**Archivo**: `apps/web/src/components/dashboard-shell.tsx`
**Líneas**: 258-266

El botón de búsqueda global con atajo `⌘K` no tiene `onClick` ni ningún listener. Opciones:

**Opción A (recomendada)**: Eliminarlo completamente hasta que la funcionalidad de búsqueda esté implementada.
**Opción B**: Implementar la búsqueda global básica (no requerido en este spec).

Eliminar el bloque completo:

```tsx
<button
  type="button"
  className="hidden items-center gap-2 ..."
>
  <Search className="h-3.5 w-3.5" />
  Buscar
  <kbd ...>⌘K</kbd>
</button>
```

Si al eliminar el botón el import de `Search` queda sin usar, eliminarlo también de los imports de `lucide-react`.

---

## Invariantes que el agente DEBE respetar

1. **No romper imports existentes**: al mover archivos, actualizar TODOS los archivos que los importan.
2. **No cambiar la interfaz pública de hooks ni funciones**: solo reorganizar/mover, no cambiar firmas.
3. **Ejecutar `pnpm typecheck` al finalizar cada fase** y corregir cualquier error de tipos antes de continuar.
4. **No agregar `// eslint-disable` como solución**: corregir el problema real.
5. **No modificar archivos de test existentes** a menos que se necesite actualizar imports.
6. **No modificar el schema de Prisma** en esta ronda (F1-7 agrega lógica en el repositorio, no en el schema).
7. **Mantener el runtime `edge`** en los archivos que ya lo tienen (`work-orders/[id]/page.tsx` incluido).
8. **El split de F3-1 debe verificar** que `'use client'` y `export const runtime = 'edge'` estén en el `page.tsx` resultante, no en los sub-componentes (los sub-componentes heredan).
