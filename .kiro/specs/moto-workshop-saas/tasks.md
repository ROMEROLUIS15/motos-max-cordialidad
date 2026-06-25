# Implementation Plan: MotoWorkshop SaaS (Fase 1 MVP)

## Overview

Plan de implementación del MVP de MotoWorkshop SaaS para un equipo de un solo desarrollador. Cubre los 9 Epics del sistema: fundamentos, autenticación propia (jsonwebtoken + bcrypt), clientes y vehículos, workshop con recepción y órdenes de trabajo, inventario con tres niveles de stock, cotizaciones PDF y pagos, WhatsApp con agente de IA RouterAgent, dashboard con métricas en tiempo real, y auditoría inmutable.

Stack: NestJS + Next.js 14 + PostgreSQL (Neon) + Cloudflare R2 + Redis + BullMQ (solo whatsapp-outbound).

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": ["1.1.1", "1.1.2", "1.1.3", "1.1.4", "1.1.5", "1.2.1", "1.2.2", "1.2.3", "1.2.4", "1.3.1", "1.3.2", "1.3.3"]
    },
    {
      "wave": 2,
      "tasks": ["2.1.1", "2.1.2", "2.1.3", "2.1.4", "2.2.1", "2.2.2", "2.2.3", "2.2.4", "2.2.5", "2.3.1", "2.3.2", "2.3.3", "2.3.4", "2.3.5", "2.3.6", "2.4.1", "2.4.2", "2.4.3", "2.4.4", "2.4.5", "2.4.6", "2.4.7", "2.4.8", "2.5.1", "2.5.2", "2.5.3", "2.5.4", "2.5.5", "2.5.6", "2.5.7"]
    },
    {
      "wave": 3,
      "tasks": ["3.1.1", "3.1.2", "3.1.3", "3.1.4", "3.1.5", "3.1.6", "3.1.7", "3.1.8", "3.1.9", "3.1.10", "3.1.11", "3.2.1", "3.2.2", "3.2.3", "3.2.4", "3.2.5", "3.2.6", "3.2.7", "3.2.8", "3.2.9", "3.2.10"]
    },
    {
      "wave": 4,
      "tasks": ["4.1.1", "4.1.2", "4.1.3", "4.1.4", "4.1.5", "4.1.6", "4.1.7", "4.1.8", "4.2.1", "4.2.2", "4.2.3", "4.2.4", "4.2.5", "4.2.6", "4.2.7", "4.2.8", "4.2.9", "4.2.10", "4.2.11", "4.2.12", "4.2.13", "4.2.14", "4.3.1", "4.3.2", "4.3.3", "4.3.4"]
    },
    {
      "wave": 5,
      "tasks": ["5.1.1", "5.1.2", "5.1.3", "5.1.4", "5.1.5", "5.1.6", "5.1.7", "5.1.8", "5.1.9", "5.1.10", "5.2.1", "5.2.2", "5.2.3", "5.2.4", "5.2.5", "5.2.6", "5.2.7", "5.2.8", "5.2.9", "5.3.1", "5.3.2", "5.3.3", "5.3.4", "5.3.5", "5.3.6", "6.1.1", "6.1.2", "6.1.3", "6.1.4", "6.1.5", "6.1.6", "6.1.7", "6.1.8", "6.1.9", "6.1.10", "6.1.11", "6.1.12", "6.1.13", "6.2.1", "6.2.2", "6.2.3", "6.2.4", "6.2.5", "6.2.6"]
    },
    {
      "wave": 6,
      "tasks": ["7.1.1", "7.1.2", "7.1.3", "7.1.4", "7.1.5", "7.1.6", "7.1.7", "7.1.8", "7.1.9", "7.2.1", "7.2.2", "7.2.3", "7.2.4", "7.2.5", "7.2.6", "7.2.7", "7.2.8"]
    },
    {
      "wave": 7,
      "tasks": ["8.1.1", "8.1.2", "8.1.3", "8.1.4", "8.1.5", "8.2.1", "8.2.2", "8.2.3", "8.2.4", "8.2.5", "8.2.6", "8.2.7", "8.3.1", "8.3.2", "8.3.3", "8.3.4", "8.3.5", "8.3.6"]
    },
    {
      "wave": 8,
      "tasks": ["9.1.1", "9.1.2", "9.1.3", "9.1.4", "9.1.5", "9.2.1", "9.2.2", "9.2.3", "9.3.1", "9.3.2", "9.3.3", "9.3.4", "9.3.5"]
    }
  ]
}
```

## Tasks

---

## Convenciones

- `[ ]` Tarea pendiente  
- `[x]` Tarea completada  
- **Prioridad**: 🔴 Bloqueante · 🟡 Alta · 🟢 Normal  
- Cada tarea tiene criterios de aceptación verificables

---

## Dependency Graph (orden de implementación)

```
Epic 1 (Fundamentos)
  └─→ Epic 2 (Identity & Auth)
        └─→ Epic 3 (Customers & Vehicles)
              └─→ Epic 4 (Workshop)
                    ├─→ Epic 5 (Inventory)
                    └─→ Epic 6 (Commerce)
                          └─→ Epic 7 (WhatsApp & AI)
                                └─→ Epic 8 (Dashboard & Notifications)
                                      └─→ Epic 9 (Audit & Config)
```

---

## EPIC 1 — Fundamentos del Proyecto

**Objetivo**: scaffolding, infraestructura base y CI/CD operativos.

### Feature 1.1 — Monorepo y Scaffolding

**User Story**: Como desarrollador, quiero el proyecto configurado desde el primer día con todas las herramientas de calidad, para no tener deuda técnica desde el inicio.

#### Tasks

- [x] 🔴 **1.1.1** Inicializar monorepo con `pnpm workspaces`
  - Estructura: `apps/api/`, `apps/web/`, `packages/types/`
  - `pnpm-workspace.yaml` configurado
  - `tsconfig.base.json` con `strict: true`

- [x] 🔴 **1.1.2** Scaffold NestJS backend (`apps/api`)
  - `nest new api --strict`
  - Eliminar `@nestjs/passport`, `@nestjs/jwt` de dependencias
  - Agregar: `jsonwebtoken`, `bcrypt`, `@types/jsonwebtoken`, `@types/bcrypt`
  - `tsconfig.json` extendiendo base con `strict: true`

- [x] 🔴 **1.1.3** Scaffold Next.js frontend (`apps/web`)
  - `npx create-next-app@latest web --typescript --tailwind --app --src-dir`
  - Instalar: `shadcn/ui`, `@tanstack/react-query`, `zustand`, `react-hook-form`, `zod`

- [x] 🟡 **1.1.4** Configurar ESLint + Prettier en ambas apps
  - Reglas: `no-explicit-any`, `no-console` (warn), import order
  - Pre-commit hook con `husky` + `lint-staged`

- [x] 🟢 **1.1.5** Configurar Vitest para `apps/web` y Jest para `apps/api`

**Acceptance Criteria**:
- `pnpm typecheck` pasa sin errores en ambas apps
- `pnpm lint` pasa sin errores
- `pnpm test` ejecuta los test suites (aunque vacíos)

---

### Feature 1.2 — Docker y Base de Datos

**User Story**: Como desarrollador, quiero el entorno de desarrollo reproducible con Docker, para no depender de configuraciones locales.

#### Tasks

- [x] 🔴 **1.2.1** Configurar `docker-compose.yml` para desarrollo
  - Servicio `redis:7-alpine` en puerto 6379 con volumen persistente
  - Variables de entorno desde `.env.local`

- [x] 🔴 **1.2.2** Configurar Prisma ORM
  - `prisma init` en `apps/api`
  - Configurar `DATABASE_URL` apuntando a Neon (branch `dev`)
  - Verificar conexión: `prisma db pull` o `prisma migrate dev`

- [x] 🔴 **1.2.3** Crear schema Prisma inicial (Fase 1 completo)
  - Modelos: `Tenant`, `Branch`, `Role`, `RolePermission`, `User`, `RefreshToken`
  - Modelos: `Customer`, `Vehicle`, `VehicleOwnershipHistory`
  - Modelos: `VehicleReception`, `ReceptionPhoto`
  - Modelos: `WorkOrder`, `WorkOrderLine`, `WorkOrderPart`, `WorkOrderStatusHistory`, `PhotoEvidence`
  - Modelos: `Part`, `PartBranchStock`, `StockEntry`
  - Modelos: `ServiceCatalogItem`
  - Modelos: `Quote`, `QuoteVersion`, `Payment`
  - Modelos: `WhatsAppSession`, `Message`
  - Modelos: `Notification`, `AuditLog`, `AuthFailureLog`
  - Todos los índices del `database-design.md`

- [x] 🔴 **1.2.4** Ejecutar primera migración
  - `prisma migrate dev --name init`
  - Verificar que todos los índices se crearon

**Acceptance Criteria**:
- `docker-compose up` levanta Redis sin errores
- `prisma migrate dev` aplica sin errores
- `prisma studio` muestra todas las tablas
- Columna generada `stock_disponible` existe en `part_branch_stocks`

---

### Feature 1.3 — CI/CD Pipeline

**User Story**: Como desarrollador, quiero despliegues automáticos al hacer push a `main`, para no hacer deploys manuales.

#### Tasks

- [x] 🟡 **1.3.1** Configurar GitHub Actions: test + typecheck
  - Job `test`: `pnpm test:ci`
  - Job `typecheck`: `pnpm typecheck`

- [x] 🟡 **1.3.2** Configurar GitHub Actions: migrate + deploy API
  - Job `migrate`: `prisma migrate deploy` contra DB de producción
  - Job `deploy-api`: build Docker image y deploy al servidor

- [x] 🟢 **1.3.3** Configurar Cloudflare Pages para `apps/web`
  - Conectar repositorio GitHub a Cloudflare Pages
  - Build command: `pnpm --filter web build`
  - Output dir: `apps/web/.next`

**Acceptance Criteria**:
- Push a `main` ejecuta el pipeline completo
- El frontend se despliega en Cloudflare Pages automáticamente
- Las migraciones se aplican antes del deploy del backend

---

## EPIC 2 — Identity, Autenticación y Autorización

**Objetivo**: multi-tenant, roles, permisos y autenticación JWT propia operativos.

### Feature 2.1 — Infraestructura de Autenticación

**User Story**: Como desarrollador, quiero servicios de JWT y hashing propios, para no depender de `@nestjs/passport`.

#### Tasks

- [x] 🔴 **2.1.1** Implementar `JwtPort` interface
  - Archivo: `application/ports/jwt.port.ts`
  - Métodos: `sign(payload): string`, `verify(token): JWTPayload`
  - Interface `JWTPayload`: `sub`, `tenantId`, `branchId`, `roleId`

- [x] 🔴 **2.1.2** Implementar `JwtService`
  - Archivo: `infrastructure/auth/jwt.service.ts`
  - Usa `jsonwebtoken` directamente
  - `sign()`: genera token con `expiresIn` desde config
  - `verify()`: retorna payload o lanza `UnauthorizedException`
  - Maneja `TokenExpiredError` y `JsonWebTokenError` explícitamente

- [x] 🔴 **2.1.3** Implementar `PasswordService`
  - Archivo: `infrastructure/auth/password.service.ts`
  - Usa `bcrypt` con `SALT_ROUNDS = 12`
  - Métodos: `hash(plaintext): Promise<string>`, `verify(plaintext, hashed): Promise<boolean>`

- [x] 🔴 **2.1.4** Implementar `FieldEncryptionService`
  - Archivo: `infrastructure/crypto/field-encryption.service.ts`
  - AES-256-GCM con `node:crypto` nativo
  - `encrypt(plaintext): string`, `decrypt(ciphertext): string`
  - Clave desde `ENCRYPTION_KEY` (hex 64 chars)

**Acceptance Criteria**:
- Unit test: `JwtService.verify()` lanza `UnauthorizedException` con token expirado
- Unit test: `JwtService.verify()` lanza `UnauthorizedException` con token inválido
- Unit test: `PasswordService.verify()` retorna `false` con contraseña incorrecta
- Unit test: `FieldEncryptionService` — encrypt → decrypt produce el texto original

---

### Feature 2.2 — Guards HTTP

**User Story**: Como desarrollador, quiero guards que protejan los endpoints sin Passport, para control de acceso limpio.

#### Tasks

- [x] 🔴 **2.2.1** Implementar `JwtAuthGuard`
  - Archivo: `presentation/http/guards/jwt-auth.guard.ts`
  - Extrae token del header `Authorization: Bearer <token>`
  - Llama `JwtService.verify()`, adjunta `user` al request
  - Lanza `UnauthorizedException` si no hay token o es inválido

- [x] 🔴 **2.2.2** Implementar `PermissionGuard`
  - Archivo: `presentation/http/guards/permission.guard.ts`
  - Lee el permiso requerido del metadata del handler (`@RequirePermission`)
  - Resuelve permisos del `roleId` desde Redis (TTL 5 min)
  - Si no está en caché, query a `RoleRepository.findByIdWithPermissions()`
  - Retorna `true` si el permiso está en la lista, `false` caso contrario

- [x] 🔴 **2.2.3** Implementar decorador `@RequirePermission(permission: string)`
  - Archivo: `presentation/http/decorators/require-permission.decorator.ts`
  - Usa `SetMetadata`

- [x] 🟡 **2.2.4** Implementar decorador `@CurrentUser()`
  - Extrae `user` del request con `createParamDecorator`

- [x] 🟡 **2.2.5** Implementar `TraceIdInterceptor`
  - Genera UUID v4 por request
  - Lo adjunta al request como `request.traceId`
  - Lo incluye en la respuesta HTTP como header `X-Trace-Id`

**Acceptance Criteria**:
- `GET /api/customers` sin token retorna 401
- `GET /api/customers` con token válido pero sin permiso `customers:READ` retorna 403
- `GET /api/customers` con token válido y permiso `customers:READ` retorna 200
- Revocación de permiso en BD se refleja en máximo 5 min (TTL caché)

---

### Feature 2.3 — Gestión de Tenants y Branches

**User Story**: Como administrador de plataforma, quiero crear tenants y branches manualmente, para onboardear nuevos clientes.

#### Tasks

- [x] 🔴 **2.3.1** Entidad de dominio `Tenant`
  - Archivo: `domain/entities/tenant.entity.ts`
  - Campos según `business-domain.md`
  - Método: `updateConfig(data)`, `updateLogo(url)`

- [x] 🔴 **2.3.2** Entidad de dominio `Branch`
  - Archivo: `domain/entities/branch.entity.ts`
  - Método: `deactivate()`, `activate()`

- [x] 🔴 **2.3.3** Use case `CreateTenant`
  - Sin UI en Fase 1 (solo script/seed)
  - Crea el tenant + Branch principal + Role OWNER predefinido + User OWNER

- [x] 🔴 **2.3.4** Use case `CreateBranch`
  - Valida que el `tenantId` existe
  - Crea Branch con `is_active = true`

- [x] 🟡 **2.3.5** Use case `UpdateTenantConfig`
  - Actualiza campos de configuración del Tenant
  - `whatsapp_token` se guarda cifrado via `FieldEncryptionService`

- [x] 🟡 **2.3.6** Endpoints REST
  - `POST /api/tenants` (sin auth — solo para setup inicial)
  - `GET /api/tenants/me` (retorna config del tenant del usuario autenticado)
  - `PUT /api/tenants/me`
  - `POST /api/branches`
  - `GET /api/branches`
  - `PUT /api/branches/:id`

**Acceptance Criteria**:
- Se puede crear un Tenant con su Branch y User OWNER desde un seed script
- `GET /api/tenants/me` retorna la configuración del tenant sin el `whatsapp_token` en claro
- `whatsapp_token` en BD está cifrado (no legible en plaintext)

---

### Feature 2.4 — Roles, Permisos y Usuarios

**User Story**: Como OWNER, quiero gestionar usuarios y roles, para controlar el acceso de mi equipo.

#### Tasks

- [x] 🔴 **2.4.1** Entidad `Role` y `Permission`
  - `domain/entities/role.entity.ts`
  - Roles predefinidos: `OWNER`, `ADMIN`, `RECEPTIONIST`, `TECHNICIAN`, `VIEWER`
  - Permiso format: `{module}:{action}` (e.g. `customers:READ`)

- [x] 🔴 **2.4.2** Seed de roles y permisos predefinidos
  - Script que crea los 5 roles base con sus permisos para cada nuevo Tenant
  - Ejecutado automáticamente al crear un Tenant

- [x] 🔴 **2.4.3** Use case `CreateUser`
  - Valida email único por Tenant
  - Hashea contraseña con `PasswordService`
  - Asigna Role por defecto

- [x] 🟡 **2.4.4** Use case `UpdateUser` / `DeactivateUser`
- [x] 🟡 **2.4.5** Use case `AssignRole`
- [x] 🟡 **2.4.6** Use case `CreateCustomRole` + `UpdateRolePermissions`
  - Solo OWNER y ADMIN pueden crear roles personalizados
  - Invalida caché de permisos del role al actualizar

- [x] 🟡 **2.4.7** Use case `DeleteRole`
  - Requiere que ningún User tenga ese Role asignado
  - Si hay usuarios: retorna error descriptivo indicando cuántos

- [x] 🟡 **2.4.8** Endpoints REST
  - `GET /api/users`, `POST /api/users`, `PUT /api/users/:id`, `DELETE /api/users/:id`
  - `GET /api/roles`, `POST /api/roles`, `PUT /api/roles/:id`, `DELETE /api/roles/:id`

**Acceptance Criteria**:
- TECHNICIAN solo puede ver sus propias WorkOrders (verificado via `PermissionGuard` + filtro en repo)
- Eliminar Role con usuarios asignados retorna 409 con mensaje descriptivo
- Un nuevo usuario puede autenticarse inmediatamente después de ser creado

---

### Feature 2.5 — Autenticación de Usuarios

**User Story**: Como empleado del taller, quiero iniciar sesión con email y contraseña para acceder al sistema.

#### Tasks

- [x] 🔴 **2.5.1** Use case `AuthenticateUser`
  - Busca usuario por email + tenantId
  - Verifica contraseña con `PasswordService`
  - Genera `accessToken` (15 min) y `refreshToken` (7 días)
  - Almacena refresh token hasheado en BD

- [x] 🔴 **2.5.2** Use case `RefreshToken`
  - Busca token por hash, verifica no expirado
  - Rotación: invalida el actual, crea uno nuevo
  - Retorna nuevo `accessToken` + nuevo `refreshToken`

- [x] 🔴 **2.5.3** Use case `RevokeToken` (logout)
  - Marca el refresh token como revocado

- [x] 🔴 **2.5.4** Endpoints REST
  - `POST /api/auth/login`
  - `POST /api/auth/refresh`
  - `POST /api/auth/logout`

- [x] 🟡 **2.5.5** Registrar fallos de autenticación
  - `POST /api/auth/login` fallido → insertar en `auth_failure_logs` con IP, email, timestamp

- [x] 🟡 **2.5.6** Rate limiting en login
  - `@nestjs/throttler` con 5 intentos por 5 minutos por IP

- [x] 🔴 **2.5.7** Login UI (Next.js)
  - Página `/login` con formulario email + contraseña
  - Manejo de errores: credenciales inválidas, cuenta inactiva
  - Redirect a `/` tras login exitoso
  - Persistir tokens en `httpOnly cookies` o `localStorage` (decisión: cookies httpOnly para mayor seguridad)

**Acceptance Criteria**:
- `POST /api/auth/login` con credenciales válidas retorna `accessToken` + `refreshToken`
- `POST /api/auth/login` con contraseña incorrecta retorna 401
- Después de 5 intentos fallidos desde la misma IP en 5 min, retorna 429
- `POST /api/auth/refresh` con token válido retorna nuevos tokens
- El refresh token anterior queda invalidado tras la rotación
- El usuario puede acceder a la app tras login exitoso

---

## EPIC 3 — Clientes y Vehículos

**Objetivo**: gestión completa de clientes y vehículos con historial.

### Feature 3.1 — Gestión de Clientes

**User Story**: Como recepcionista, quiero registrar y buscar clientes con historial completo, para dar atención personalizada y ágil.

#### Tasks

- [x] 🔴 **3.1.1** Entidad de dominio `Customer`
  - `domain/entities/customer.entity.ts`
  - Validaciones: `documentNumber` no vacío, `phone` no vacío
  - Método: `deactivate()` (soft delete), `incrementVisitCount()`, `updateLastVisit()`

- [x] 🔴 **3.1.2** Repository interface `CustomerRepository`
  - `findById(id, tenantId)`: retorna Customer o null
  - `findByDocument(documentNumber, tenantId)`: para validar duplicados
  - `search(query, tenantId, pagination)`: búsqueda por nombre, doc, teléfono
  - `save(customer)`, `create(customer)`

- [x] 🔴 **3.1.3** Implementación Prisma `CustomerPrismaRepository`
  - Todos los métodos con `tenantId` obligatorio en where clause
  - `search()` usa índice GIN full-text para nombre + ilike para doc/teléfono

- [x] 🔴 **3.1.4** Use case `RegisterCustomer`
  - Verifica que `documentNumber` no exista en el mismo Tenant
  - Crea Customer con `is_active = true`, `visit_count = 0`

- [x] 🔴 **3.1.5** Use case `UpdateCustomer`
- [x] 🔴 **3.1.6** Use case `DeactivateCustomer` (soft delete — `deleted_at`)
- [x] 🔴 **3.1.7** Use case `SearchCustomers` (paginado)
- [x] 🔴 **3.1.8** Use case `GetCustomerProfile`
  - Retorna Customer + sus Vehicles + últimas 10 WorkOrders

- [x] 🔴 **3.1.9** Endpoints REST
  - `GET /api/customers?search=&page=&pageSize=`
  - `POST /api/customers`
  - `GET /api/customers/:id`
  - `PUT /api/customers/:id`
  - `DELETE /api/customers/:id`
  - `GET /api/customers/:id/vehicles`
  - `GET /api/customers/:id/work-orders`

- [x] 🔴 **3.1.10** UI — Listado de Clientes (`/customers`)
  - Tabla con búsqueda en tiempo real (debounce 300ms)
  - Columnas: nombre, documento, teléfono, ciudad, visitas, estado
  - Botón "Nuevo cliente"
  - Indicador visual si tiene WorkOrder activa

- [x] 🔴 **3.1.11** UI — Ficha de Cliente (`/customers/:id`)
  - Datos del cliente editables inline o modal
  - Sección: vehículos asociados
  - Sección: historial de órdenes (últimas 10, ver más con paginación)
  - Botón "Nueva recepción" → redirige a formulario de recepción

**Acceptance Criteria**:
- Registrar cliente con documento duplicado retorna 409
- Búsqueda por placa de vehículo asociado devuelve el cliente correcto
- Soft delete preserva el cliente en BD con `deleted_at` no nulo
- Clientes de otro tenant no aparecen en ningún listado
- `visit_count` solo cuenta WorkOrders en estado DELIVERED

---

### Feature 3.2 — Gestión de Vehículos

**User Story**: Como técnico o recepcionista, quiero gestionar el historial completo de cada moto, para tener trazabilidad total de servicios.

#### Tasks

- [x] 🔴 **3.2.1** Entidad de dominio `Vehicle`
  - `domain/entities/vehicle.entity.ts`
  - Validaciones: `plate` no vacío, `year` entre 1950 y año actual + 1
  - Método: `updateOdometer(reading)`, `transferOwnership(newOwnerId)`, `deactivate()`

- [x] 🔴 **3.2.2** Repository interface `VehicleRepository`
  - `findById(id, tenantId)`
  - `findByPlate(plate, tenantId)`: para validar duplicados
  - `findByCustomer(customerId, tenantId)`
  - `hasActiveWorkOrder(vehicleId, tenantId)`: boolean
  - `save(vehicle)`, `create(vehicle)`

- [x] 🔴 **3.2.3** Implementación Prisma `VehiclePrismaRepository`

- [x] 🔴 **3.2.4** Use case `RegisterVehicle`
  - Verifica placa única en el Tenant
  - Crea Vehicle asociado al Customer propietario

- [x] 🔴 **3.2.5** Use case `UpdateVehicle`
- [x] 🔴 **3.2.6** Use case `DeactivateVehicle` (soft delete)
- [x] 🟡 **3.2.7** Use case `TransferVehicleOwnership`
  - Registra en `vehicle_ownership_history`
  - Actualiza `current_owner_id`

- [x] 🔴 **3.2.8** Use case `GetVehicleHistory`
  - Retorna Vehicle + todas sus WorkOrders + Parts utilizados + PhotoEvidences

- [x] 🔴 **3.2.9** Endpoints REST
  - `GET /api/vehicles?customerId=&page=&pageSize=`
  - `POST /api/vehicles`
  - `GET /api/vehicles/:id`
  - `PUT /api/vehicles/:id`
  - `DELETE /api/vehicles/:id`
  - `POST /api/vehicles/:id/transfer`
  - `GET /api/vehicles/:id/history`

- [x] 🟡 **3.2.10** UI — Ficha de Vehículo (`/vehicles/:id`)
  - Datos básicos (placa, marca, modelo, año, color, motor)
  - Historial de WorkOrders en timeline
  - Historial de odómetro
  - Galería de evidencias fotográficas

**Acceptance Criteria**:
- Registrar vehículo con placa duplicada en el mismo Tenant retorna 409
- Un vehículo con WorkOrder activa no puede recibir nueva WorkOrder (409 con mensaje claro)
- La transferencia de propiedad queda registrada con fecha, propietario anterior y nuevo
- Soft delete del vehículo no elimina sus WorkOrders ni fotos de R2

---

## EPIC 4 — Workshop: Recepción y Órdenes de Trabajo

**Objetivo**: flujo completo de recepción de vehículo → orden de trabajo → entrega.

### Feature 4.1 — Recepción de Vehículos

**User Story**: Como recepcionista, quiero registrar el estado del vehículo al ingreso con fotos, para proteger legalmente al taller ante reclamos.

#### Tasks

- [x] 🔴 **4.1.1** Entidad de dominio `VehicleReception`
  - `domain/entities/vehicle-reception.entity.ts`
  - Campos: `vehicleId`, `customerId`, `receivedAt`, `receivedBy`, `odometerReading`, `fuelLevel`, `observations?`, `visibleDamageNotes?`
  - Valor objeto `FuelLevel`: EMPTY, QUARTER, HALF, THREE_QUARTERS, FULL

- [x] 🔴 **4.1.2** Repository interface `VehicleReceptionRepository`
  - `create(reception)`, `findById(id, tenantId)`, `addPhoto(receptionId, photo)`

- [x] 🔴 **4.1.3** Implementación Prisma `VehicleReceptionPrismaRepository`

- [x] 🔴 **4.1.4** Use case `CreateVehicleReception`
  - Valida que el Vehicle existe y pertenece al Tenant
  - Crea VehicleReception
  - NO crea WorkOrder — eso es un paso posterior

- [x] 🔴 **4.1.5** Use case `AddReceptionPhoto`
  - Acepta `Buffer` de imagen (JPEG, PNG, WebP)
  - Comprime con `sharp` si supera 2MB (calidad 80% para JPEG/WebP; PNG → WebP)
  - Sube a R2: `/{tenant_id}/{branch_id}/receptions/{reception_id}/photos/{filename}`
  - Guarda `r2_key` en `reception_photos`
  - Máximo 10 fotos por recepción

- [x] 🔴 **4.1.6** Infraestructura: `CloudflareR2Adapter`
  - Archivo: `infrastructure/storage/cloudflare-r2.adapter.ts`
  - Implementa `StoragePort`
  - Métodos: `upload(key, buffer, contentType)`, `getSignedUrl(key, expiresInSeconds)`, `delete(key)`
  - URLs pre-firmadas: 24 horas (86400 segundos)

- [x] 🔴 **4.1.7** Endpoints REST
  - `POST /api/receptions`
  - `GET /api/receptions/:id`
  - `POST /api/receptions/:id/photos` (multipart/form-data)
  - `DELETE /api/receptions/:id/photos/:photoId`

- [x] 🔴 **4.1.8** UI — Formulario de Recepción (`/receptions/new`)
  - Selector de cliente (búsqueda por nombre/doc/teléfono)
  - Selector de vehículo del cliente (o registrar nuevo)
  - Campos: odómetro, nivel de combustible (selector visual), observaciones, daños visibles
  - Upload de fotos drag & drop (máx 10, preview inmediato)
  - Botón "Crear Orden de Trabajo" tras guardar

**Acceptance Criteria**:
- Una VehicleReception sin photos es válida
- Fotos > 2MB se comprimen antes de subir (verificar tamaño en R2)
- PNG se convierte a WebP antes de comprimir
- URL pre-firmada de foto expira en 24h
- Intentar subir formato no permitido retorna 422 con mensaje de formatos aceptados

---

### Feature 4.2 — Ciclo de Vida de Órdenes de Trabajo

**User Story**: Como jefe de taller, quiero gestionar el ciclo completo de las órdenes para coordinar el equipo y cumplir los tiempos prometidos.

#### Tasks

- [x] 🔴 **4.2.1** Entidad de dominio `WorkOrder` con máquina de estados
  - `domain/entities/work-order.entity.ts`
  - Valor objeto `WorkOrderStatus` con `VALID_TRANSITIONS`
  - Método `transitionTo(newStatus)`: lanza `WorkOrderInvalidTransitionException` si es inválido
  - Método `isNearDeadline(hoursThreshold = 2): boolean`
  - Método `softDelete()`: lanza si status es DELIVERED

- [x] 🔴 **4.2.2** Excepciones de dominio
  - `WorkOrderInvalidTransitionException`
  - `VehicleHasActiveOrderException`
  - `InsufficientStockException`

- [x] 🔴 **4.2.3** Repository interface `WorkOrderRepository`
  - `findById(id, tenantId)`: sin includes
  - `findByIdWithDetails(id, tenantId)`: con lines, parts, statusHistory, photoEvidences
  - `findByBranch(branchId, tenantId, filters, pagination)`
  - `findByTechnician(technicianId, tenantId, filters, pagination)` — para TECHNICIAN
  - `findNearingDeadline(threshold, branchId?, tenantId)`: para alertas
  - `countActiveByStatus(branchId, tenantId)`
  - `save(workOrder)`, `create(workOrder)`
  - `saveStatusHistory(entry)`
  - `generateOrderNumber(tenantId, year)`: retorna siguiente correlativo `WO-{YYYY}-{NNNNNN}`

- [x] 🔴 **4.2.4** Implementación Prisma `WorkOrderPrismaRepository`
  - `findById`: sin `include` (rápido)
  - `findByIdWithDetails`: con todos los includes
  - Todos los métodos con `tenantId` obligatorio
  - Filtro `deletedAt: null` en todas las queries

- [x] 🔴 **4.2.5** Use case `CreateWorkOrder`
  - Requiere `receptionId` — la WorkOrder siempre nace de una VehicleReception
  - Verifica que el Vehicle no tenga WorkOrder activa (`hasActiveWorkOrder`)
  - Genera `orderNumber` con formato `WO-{YYYY}-{NNNNNN}`
  - Crea WorkOrder con `status = PENDING`

- [x] 🔴 **4.2.6** Use case `TransitionWorkOrderStatus`
  - Llama `workOrder.transitionTo(newStatus)` — lanza si es inválido
  - Si → DELIVERED: llama `inventoryPort.confirmStockDiscount()`
  - Si → CANCELLED: llama `inventoryPort.releaseAllReservations()`
  - Si → COMPLETED: envía WhatsApp via `messagingPort`, notifica admins
  - Si → WAITING_PARTS: envía WhatsApp via `messagingPort`
  - Guarda WorkOrder + StatusHistory

- [x] 🔴 **4.2.7** Use case `AddServiceLine`
  - Acepta `serviceCatalogId?` (opcional — si viene del catálogo, precarga nombre y precio)
  - Si `serviceCatalogId` es null: usa `description` y `unitPrice` libres

- [x] 🔴 **4.2.8** Use case `UpdateServiceLine`
- [x] 🔴 **4.2.9** Use case `RemoveServiceLine`

- [x] 🔴 **4.2.10** Use case `AddPartToWorkOrder`
  - Llama `inventoryPort.reserveStock(partId, branchId, quantity)`
  - Si stock insuficiente: lanza `InsufficientStockException`
  - Congela `unitPriceAtSale = Part.salePrice` al momento de la adición

- [x] 🔴 **4.2.11** Use case `RemovePartFromWorkOrder`
  - Llama `inventoryPort.releaseReservation(partId, branchId, quantity)`

- [x] 🔴 **4.2.12** Endpoints REST WorkOrders
  - `GET /api/work-orders?status=&branchId=&technicianId=&from=&to=&page=&pageSize=`
  - `POST /api/work-orders`
  - `GET /api/work-orders/:id` (usa `findByIdWithDetails`)
  - `PUT /api/work-orders/:id`
  - `DELETE /api/work-orders/:id`
  - `POST /api/work-orders/:id/status`
  - `POST /api/work-orders/:id/lines`
  - `PUT /api/work-orders/:id/lines/:lineId`
  - `DELETE /api/work-orders/:id/lines/:lineId`
  - `POST /api/work-orders/:id/parts`
  - `DELETE /api/work-orders/:id/parts/:partId`

- [x] 🔴 **4.2.13** UI — Listado de Órdenes (`/work-orders`)
  - Tabla con filtros: estado, técnico, fecha
  - Columnas: número, cliente, vehículo, técnico, estado, fecha prometida, total
  - Indicador visual de órdenes próximas a vencer (rojo si ≤ 2h)
  - Botón "Nueva orden"

- [x] 🔴 **4.2.14** UI — Detalle de Orden (`/work-orders/:id`)
  - Header: datos del cliente, vehículo, técnico, estado actual con badge de color
  - Sección: datos de recepción (odómetro, combustible, fotos de ingreso)
  - Sección: líneas de servicio (editable, con autocompletado del catálogo)
  - Sección: repuestos (con validación de stock en tiempo real)
  - Sección: evidencias fotográficas por fase (INGRESO, PROCESO, ENTREGA)
  - Footer: total calculado en tiempo real + historial de estado
  - Botones de transición de estado (solo estados válidos desde el actual)

**Acceptance Criteria**:
- Transición DELIVERED → CANCELLED retorna 422 con código `WORK_ORDER_INVALID_TRANSITION`
- Transición PENDING → COMPLETED retorna 422
- Al pasar a DELIVERED, el stock físico del Part disminuye y `stock_reservado` se libera
- Al pasar a CANCELLED, solo se libera `stock_reservado` (sin tocar `stock_fisico`)
- `orderNumber` es único por Tenant en formato `WO-2025-000001`
- Total de WorkOrder = suma de líneas de servicio + suma de Parts × precio congelado

---

### Feature 4.3 — Evidencias Fotográficas en WorkOrder

**User Story**: Como técnico, quiero adjuntar fotos del antes y después del servicio para documentar el trabajo.

#### Tasks

- [x] 🔴 **4.3.1** Use case `UploadPhotoEvidence`
  - Acepta imagen (JPEG, PNG, WebP, máx 10 MB)
  - Comprime si > 2MB con `sharp`
  - Sube a R2: `/{tenant_id}/{branch_id}/work-orders/{work_order_id}/evidences/{filename}`
  - Registra `phase` (INGRESO, PROCESO, ENTREGA), `description?`, `uploadedBy`
  - Máximo 20 fotos por WorkOrder
  - Falla si WorkOrder está en CANCELLED

- [x] 🟡 **4.3.2** Use case `DeletePhotoEvidence`
  - Solo si WorkOrder ≠ DELIVERED
  - Soft delete en BD (`deleted_at`); archivo en R2 NO se elimina

- [x] 🔴 **4.3.3** Use case `GetPhotoEvidenceUrls`
  - Genera URLs pre-firmadas (24h) para las fotos activas de una WorkOrder

- [x] 🔴 **4.3.4** Endpoints REST
  - `POST /api/work-orders/:id/evidences` (multipart/form-data con campo `phase`)
  - `DELETE /api/work-orders/:id/evidences/:evidenceId`
  - `GET /api/work-orders/:id/evidences`

**Acceptance Criteria**:
- Subir foto en WorkOrder CANCELLED retorna 422
- Subir más de 20 fotos retorna 422
- Subir formato `.gif` retorna 422 con lista de formatos permitidos
- Eliminar foto en WorkOrder DELIVERED retorna 422
- URLs pre-firmadas retornadas expiran en 24h

---

## EPIC 5 — Inventario de Repuestos

**Objetivo**: control de stock con tres niveles (físico, reservado, disponible) por sucursal.

### Feature 5.1 — Catálogo de Repuestos

**User Story**: Como administrador, quiero registrar y gestionar el catálogo de repuestos, para controlar precios y referencias.

#### Tasks

- [x] 🔴 **5.1.1** Entidad de dominio `Part`
  - `domain/entities/part.entity.ts`
  - Validaciones: `sku` no vacío, `costPrice >= 0`, `salePrice >= costPrice`
  - Método: `updatePrices(cost, sale)`, `deactivate()`

- [x] 🔴 **5.1.2** Entidad de dominio `PartBranchStock` (tres niveles)
  - `domain/entities/part-branch-stock.entity.ts`
  - Invariantes: `stockFisico >= 0`, `stockReservado <= stockFisico`
  - Métodos: `reserve()`, `releaseReservation()`, `confirmDiscount()`, `addStock()`, `adjust()`

- [x] 🔴 **5.1.3** Repository interface `PartRepository`
  - `findBySku(sku, tenantId)`, `findById(id, tenantId)`, `search(query, tenantId, pagination)`

- [x] 🔴 **5.1.4** Repository interface `PartStockRepository`
  - `findByPartAndBranch(partId, branchId)`
  - `save(stock)`, `upsert(stock)` — para creación automática en transferencias
  - `transferAtomically(input)` — transacción completa en infrastructure
  - `findLowStock(branchId, tenantId)`: Parts con `stock_disponible < minStockAlert`

- [x] 🔴 **5.1.5** Implementaciones Prisma

- [x] 🔴 **5.1.6** Use case `RegisterPart`
  - Valida SKU único en el Tenant
  - Crea Part + `PartBranchStock` inicial con stocks en 0 para la Branch actual

- [x] 🔴 **5.1.7** Use case `UpdatePart`
  - El cambio de `salePrice` NO afecta WorkOrderParts existentes (precio histórico)

- [x] 🟡 **5.1.8** Use case `DeactivatePart`

- [x] 🔴 **5.1.9** Endpoints REST
  - `GET /api/parts?search=&category=&page=&pageSize=`
  - `POST /api/parts`
  - `GET /api/parts/:id`
  - `PUT /api/parts/:id`
  - `DELETE /api/parts/:id`

- [x] 🔴 **5.1.10** UI — Listado de Inventario (`/inventory`)
  - Tabla con SKU, nombre, categoría, `stock_disponible`, `stock_fisico`, `stock_reservado`, alertas
  - Badge rojo si `stock_disponible < minStockAlert`
  - Búsqueda por nombre o SKU

**Acceptance Criteria**:
- SKU duplicado en el mismo Tenant retorna 409
- Cambiar `salePrice` de un Part no modifica `unitPriceAtSale` en WorkOrderParts existentes
- Listado siempre muestra `stock_disponible`, nunca `stock_fisico` crudo

---

### Feature 5.2 — Movimientos de Inventario

**User Story**: Como administrador, quiero controlar entradas, salidas y ajustes de stock, para mantener el inventario preciso.

#### Tasks

- [x] 🔴 **5.2.1** Use case `RegisterStockEntry` (ENTRADA manual)
  - Incrementa `stock_fisico`
  - Crea `StockEntry` tipo ENTRADA

- [x] 🔴 **5.2.2** Use case `RegisterStockExit` (SALIDA manual)
  - Verifica `stock_disponible >= cantidad`
  - Decrementa `stock_fisico`
  - Crea `StockEntry` tipo SALIDA

- [x] 🔴 **5.2.3** Use case `AdjustInventory` (AJUSTE por conteo físico)
  - Requiere `notes` (justificación obligatoria)
  - Calcula diferencia vs `stock_fisico` actual
  - Actualiza `stock_fisico`, crea `StockEntry` tipo AJUSTE con diferencia

- [x] 🔴 **5.2.4** Use case `TransferStockBetweenBranches`
  - Llama `partStockRepo.transferAtomically(input)`
  - La transacción Prisma vive en el repositorio (NO en el use case)
  - Si Branch destino no tiene el Part: `upsert` crea registro con stocks en 0

- [x] 🔴 **5.2.5** Use case `ReserveStock` (interno — llamado por `AddPartToWorkOrder`)
- [x] 🔴 **5.2.6** Use case `ReleaseStock` (interno — llamado al remover Part o CANCEL)
- [x] 🔴 **5.2.7** Use case `ConfirmStockDiscount` (interno — llamado al DELIVER)

- [x] 🔴 **5.2.8** Endpoints REST
  - `POST /api/stock/entry`
  - `POST /api/stock/exit`
  - `POST /api/stock/adjust`
  - `POST /api/stock/transfer`
  - `GET /api/stock/history?partId=&branchId=&from=&to=&page=&pageSize=`
  - `GET /api/stock/valuation?branchId=`
  - `GET /api/stock/low-stock?branchId=`

- [x] 🟡 **5.2.9** UI — Modal de Movimientos
  - Formulario para entrada / salida / ajuste / transferencia
  - Muestra `stock_disponible` actual al seleccionar el Part
  - Para ajuste: muestra diferencia (ganancia/merma) en tiempo real

**Acceptance Criteria**:
- Salida que deja `stock_disponible < 0` retorna 409 con `INSUFFICIENT_STOCK`
- Ajuste sin `notes` retorna 422
- Transferencia a Branch sin el Part crea el registro automáticamente (stock = 0 → entrada)
- Ambos `StockEntry` de una transferencia se crean en la misma transacción

---

### Feature 5.3 — Service Catalog

**User Story**: Como administrador, quiero un catálogo de servicios del taller, para que al crear órdenes los recepcionistas no tengan que escribir todo a mano.

#### Tasks

- [x] 🔴 **5.3.1** Entidad de dominio `ServiceCatalogItem`
  - `domain/entities/service-catalog.entity.ts`
  - Campos: `tenantId`, `name`, `description?`, `estimatedHours`, `suggestedPrice`, `serviceType`, `isActive`
  - Métodos: `deactivate()`, `update(data)`

- [x] 🔴 **5.3.2** Repository interface `ServiceCatalogRepository`
  - `findAll(tenantId, filters)`: con filtros `serviceType?`, `search?`, `isActive?`
  - `findById(id, tenantId)`
  - `save(item)`, `create(item)`

- [x] 🔴 **5.3.3** Use cases: `CreateServiceCatalogItem`, `UpdateServiceCatalogItem`, `DeactivateServiceCatalogItem`, `ListServiceCatalogItems`

- [x] 🔴 **5.3.4** Endpoints REST
  - `GET /api/service-catalog?serviceType=&search=&isActive=&page=&pageSize=`
  - `POST /api/service-catalog`
  - `GET /api/service-catalog/:id`
  - `PUT /api/service-catalog/:id`
  - `POST /api/service-catalog/:id/deactivate`

- [x] 🔴 **5.3.5** UI — Página Service Catalog (`/service-catalog`)
  - Tabla CRUD con filtro por `serviceType`
  - Modal de creación/edición

- [x] 🔴 **5.3.6** Integración en formulario de WorkOrderLine
  - Autocompletado: busca en `GET /api/service-catalog?search=`
  - Al seleccionar ítem: precarga `description`, `estimatedHours`, `unitPrice`
  - Campo siempre editable (el precargado es un punto de partida, no forzado)

**Acceptance Criteria**:
- `GET /api/service-catalog?search=aceite` retorna items que contienen "aceite" en el nombre
- Al seleccionar ítem del catálogo, WorkOrderLine recibe `serviceCatalogId` + datos precargados
- WorkOrderLine con `serviceCatalogId = null` (texto libre) es válido

---

## EPIC 6 — Commerce: Cotizaciones y Pagos

**Objetivo**: cotizaciones PDF con ciclo de vida completo y registro de pagos manuales.

### Feature 6.1 — Cotizaciones PDF

**User Story**: Como recepcionista, quiero generar cotizaciones en PDF y enviarlas al cliente por WhatsApp, para acelerar la aprobación del trabajo.

#### Tasks

- [x] 🔴 **6.1.1** Entidad de dominio `Quote`
  - `domain/entities/quote.entity.ts`
  - Estados: DRAFT, SENT, APPROVED, REJECTED, EXPIRED
  - Transiciones válidas: DRAFT→SENT, SENT→APPROVED/REJECTED, cualquier→EXPIRED (automático)
  - Método: `approve()` — retorna evento que el use case usa para actualizar WorkOrder
  - Método: `expire()`, `reject()`, `markAsSent()`

- [x] 🔴 **6.1.2** Repository interface `QuoteRepository`
  - `findById(id, tenantId)`, `save(quote)`, `create(quote)`
  - `findByWorkOrder(workOrderId, tenantId)`
  - `findExpired(now)`: para el job de expiración automática

- [x] 🔴 **6.1.3** Puerto `PdfGeneratorPort`
  - `generateQuotePdf(data: QuotePdfData): Promise<Buffer>`

- [x] 🔴 **6.1.4** Implementación `ReactPdfAdapter`
  - `infrastructure/pdf/react-pdf.adapter.ts`
  - Usa `@react-pdf/renderer` (síncrono en request-response cycle)
  - Template básico con: logo Tenant, datos cliente, vehículo, líneas de servicio, partes, IVA, total

- [x] 🔴 **6.1.5** Use case `CreateQuote`
  - Solo para WorkOrders en PENDING o IN_PROGRESS (retorna 422 en otro estado)
  - Genera `quoteNumber` formato `Q-{YYYY}-{NNNNNN}`
  - Calcula: subtotal, IVA (del Tenant), total
  - Genera PDF → sube a R2 → guarda `pdf_r2_key`
  - Quote inicia en DRAFT

- [x] 🔴 **6.1.6** Use case `UpdateQuote`
  - Incrementa `version`
  - Guarda versión anterior en `quote_versions` con snapshot JSON
  - Regenera PDF → actualiza `pdf_r2_key`

- [x] 🔴 **6.1.7** Use case `SendQuote`
  - DRAFT → SENT
  - Envía URL pre-firmada (24h) al cliente vía WhatsApp (encola en `whatsapp-outbound`)

- [x] 🔴 **6.1.8** Use case `ApproveQuote`
  - SENT → APPROVED
  - WorkOrder asociada → IN_PROGRESS automáticamente (llama `TransitionWorkOrderStatus`)

- [x] 🔴 **6.1.9** Use case `RejectQuote` (SENT → REJECTED)

- [x] 🟡 **6.1.10** Job `ExpireQuotes` via `@nestjs/schedule`
  - Cron diario a las 00:00
  - Busca Quotes SENT con `valid_until < NOW()`
  - Transiciona a EXPIRED

- [x] 🔴 **6.1.11** Use case `GetQuotePdfUrl`
  - Retorna URL pre-firmada (24h) del PDF actual

- [x] 🔴 **6.1.12** Endpoints REST
  - `GET /api/quotes?workOrderId=&status=&page=&pageSize=`
  - `POST /api/quotes`
  - `GET /api/quotes/:id`
  - `PUT /api/quotes/:id`
  - `POST /api/quotes/:id/send`
  - `POST /api/quotes/:id/approve`
  - `POST /api/quotes/:id/reject`
  - `GET /api/quotes/:id/pdf`
  - `GET /api/quotes/:id/versions`

- [x] 🟡 **6.1.13** UI — Sección Cotizaciones en Detalle de WorkOrder
  - Botón "Generar Cotización" visible si status es PENDING o IN_PROGRESS
  - Vista previa del PDF (iframe o link)
  - Botones de acción según estado actual: Enviar / Aprobar / Rechazar
  - Badge de estado con color

**Acceptance Criteria**:
- Generar Quote para WorkOrder DELIVERED retorna 422 con mensaje descriptivo
- PDF generado contiene logo del Tenant, nombre del cliente, placa del vehículo y total correcto
- Al aprobar Quote, WorkOrder cambia automáticamente a IN_PROGRESS
- Versión anterior del PDF se conserva en R2 al actualizar la Quote
- URL de PDF expira en 24h (verificar con timestamp en la URL)

---

### Feature 6.2 — Registro de Pagos

**User Story**: Como recepcionista, quiero registrar manualmente los pagos de cada orden, para llevar control financiero sin integración bancaria.

#### Tasks

- [x] 🔴 **6.2.1** Entidad de dominio `Payment`
  - `domain/entities/payment.entity.ts`
  - Invariante: `amount > 0`
  - Métodos de valor: `PaymentMethod` enum (CASH, TRANSFER, CARD, OTHER)

- [x] 🔴 **6.2.2** Repository interface `PaymentRepository`
  - `create(payment)`, `findById(id, tenantId)`
  - `findByWorkOrder(workOrderId, tenantId)`: lista de pagos
  - `sumByWorkOrder(workOrderId, tenantId)`: total cobrado
  - `sumByBranchAndPeriod(branchId, tenantId, from, to)`: para Dashboard
  - `incomeTrend(branchId, tenantId, days)`: para gráfico de tendencia

- [x] 🔴 **6.2.3** Use case `RegisterPayment`
  - Valida `amount > 0`
  - Registra Payment
  - Notifica al ADMIN vía `notificationPort` (sin BullMQ — directo por WebSocket)

- [x] 🔴 **6.2.4** Use case `GetPaymentSummary`
  - Retorna: total de la WorkOrder, total pagado, saldo pendiente, lista de pagos

- [x] 🔴 **6.2.5** Endpoints REST
  - `GET /api/payments?workOrderId=&branchId=&from=&to=&page=&pageSize=`
  - `POST /api/payments`
  - `GET /api/payments/:id`
  - `GET /api/payments/summary/:workOrderId`

- [x] 🔴 **6.2.6** UI — Sección Pagos en Detalle de WorkOrder
  - Barra de progreso: total pagado / total de la orden
  - Lista de pagos con método, monto, fecha, referencia
  - Botón "Registrar Pago" → modal con campos del Payment
  - Indicador de saldo pendiente

**Acceptance Criteria**:
- `POST /api/payments` con `amount = 0` retorna 422
- `POST /api/payments` con `amount = -50` retorna 422
- El total pagado se calcula sumando `Payment.amount` (no WorkOrder.total)
- Al registrar un pago, el ADMIN recibe notificación interna en tiempo real
- El Dashboard financiero usa `Payment.amount` (cobrado), no el total de la WorkOrder

---

## EPIC 7 — WhatsApp y Agente de IA

**Objetivo**: comunicación centralizada con clientes vía WhatsApp + RouterAgent para atención automática.

### Feature 7.1 — Integración WhatsApp (Meta Cloud API)

**User Story**: Como recepcionista, quiero gestionar toda la comunicación con clientes por WhatsApp desde el sistema.

#### Tasks

- [x] 🔴 **7.1.1** Implementación `WhatsAppCloudAdapter`
  - `infrastructure/messaging/whatsapp-cloud.adapter.ts`
  - Implementa `MessagingPort`
  - `sendMessage(to, content)`: llama a la API de Meta
  - `sendTemplate(to, templateName, params)`: para mensajes de estado
  - Manejo de errores HTTP de Meta con retry automático (máx 3 intentos)

- [x] 🔴 **7.1.2** BullMQ Queue `whatsapp-outbound`
  - Producer: `WhatsAppOutboundProducer`
  - Worker: `WhatsAppOutboundWorker`
  - `DEFAULT_JOB_OPTIONS`: 3 intentos, backoff exponencial 30s → 60s → 120s
  - Si falla 3 veces: registra mensaje como FAILED en `messages`

- [x] 🔴 **7.1.3** Use case `SendAutomaticNotification`
  - Triggered por `TransitionWorkOrderStatus`
  - Encola en `whatsapp-outbound` (no bloquea el request)
  - Plantillas: COMPLETED ("moto lista"), WAITING_PARTS ("esperando repuestos"), DELIVERY_ALERT

- [x] 🔴 **7.1.4** Use case `SendManualMessage`
  - Encola en `whatsapp-outbound`
  - Registra mensaje en `messages` con `direction = OUTBOUND`, `sentBy = userId`

- [x] 🔴 **7.1.5** Use case `ProcessIncomingMessage` (webhook handler)
  - Busca número en `Customer.phone` Y `Customer.whatsappPhone`
  - Si encontrado: asocia a `WhatsAppSession` del Customer
  - Si no encontrado: crea `WhatsAppSession` anónima (`is_anonymous = true`)
  - Notifica a RECEPTIONIST si es número desconocido
  - Registra en `messages` con `direction = INBOUND`
  - Determina si activar RouterAgent (no respondido en 5 min + horario de atención)

- [x] 🔴 **7.1.6** Webhook endpoint con verificación de firma
  - `GET /api/webhooks/whatsapp`: verificación del webhook de Meta (token challenge)
  - `POST /api/webhooks/whatsapp`: procesa mensajes entrantes
  - Verifica firma `X-Hub-Signature-256` con HMAC-SHA256 + `timingSafeEqual`
  - No requiere JWT

- [x] 🔴 **7.1.7** Use case `GetConversationHistory`
  - Retorna mensajes paginados de una `WhatsAppSession`

- [x] 🔴 **7.1.8** Endpoints REST
  - `GET /api/messages/sessions?page=&pageSize=`
  - `GET /api/messages/sessions/:sessionId`
  - `GET /api/messages/sessions/:sessionId/messages`
  - `POST /api/messages/send`

- [x] 🔴 **7.1.9** UI — Bandeja de Mensajes (`/messages`)
  - Lista de sesiones ordenadas por `lastMessageAt` DESC
  - Badge de mensajes sin leer
  - Panel de conversación con historial (scroll infinito)
  - Input de respuesta manual con botón enviar
  - Indicador de estado del mensaje (SENT, DELIVERED, READ, FAILED)
  - Badge "Anónimo" para sesiones de números no registrados

**Acceptance Criteria**:
- Webhook sin firma válida retorna 401
- Mensaje de cliente registrado aparece en su WhatsAppSession en ≤ 2 segundos
- Número desconocido crea WhatsAppSession anónima y notifica al RECEPTIONIST
- Mensaje fallido tras 3 intentos queda en estado FAILED en el historial
- Sistema continúa operando con plena funcionalidad si Meta API no está disponible

---

### Feature 7.2 — RouterAgent de IA

**User Story**: Como dueño del taller, quiero que un agente responda automáticamente las consultas frecuentes, para reducir la carga del recepcionista.

#### Tasks

- [x] 🔴 **7.2.1** Implementación `DeepSeekAdapter`
  - `infrastructure/ai/deepseek.adapter.ts`
  - Implementa `LLMProviderPort`
  - Timeout 10 segundos
  - Maneja errores HTTP y timeouts

- [x] 🔴 **7.2.2** Implementación `GroqAdapter`
  - `infrastructure/ai/groq.adapter.ts`
  - Mismo contrato que DeepSeek
  - Timeout 10 segundos

- [x] 🔴 **7.2.3** Implementación `LLMProviderFactory`
  - Intenta DeepSeek → Groq → lanza `AllLLMProvidersFailedException`
  - Captura excepciones en Sentry por proveedor

- [x] 🔴 **7.2.4** Implementación `ToolExecutor` (stateless)
  - `callCount` en `ExecutionContext` pasado por el caller
  - Valida schema con Zod antes de ejecutar
  - Timeout 5 segundos por Tool
  - Registra cada invocación en log (sin datos sensibles)

- [x] 🔴 **7.2.5** Implementar las 6 Tools de Fase 1

  **Tool `getWorkOrderStatus`**:
  - Input: `{ workOrderId: string }`
  - Llama use case `GetWorkOrderDetail`
  - Output: `{ orderNumber, status, promisedDeliveryAt, technicianName, serviceType }`

  **Tool `checkInventory`**:
  - Input: `{ partSku: string, branchId: string }`
  - Llama use case `GetPartDetail` con `stock_disponible`
  - Output: `{ partName, stockDisponible, unit, isAvailable }`

  **Tool `getVehicleHistory`**:
  - Input: `{ vehicleId: string }`
  - Llama use case `GetVehicleHistory`
  - Output: últimas 5 WorkOrders del vehículo

  **Tool `createAppointment`**:
  - Input: `{ customerId, requestedDate, serviceType, notes? }`
  - Crea `VehicleReception` preliminar (pre-agendamiento)
  - Output: `{ receptionId, confirmedAt, branchAddress }`

  **Tool `createQuote`**:
  - Input: `{ workOrderId }`
  - Llama use case `CreateQuote`
  - Output: `{ quoteNumber, total, pdfUrl, validUntil }`

  **Tool `getBusinessInformation`**:
  - Input: `{ infoType: 'hours' | 'location' | 'services' | 'general' }`
  - Lee de `Tenant.businessHours`, `Tenant.address`, etc.
  - Disponible para números NO registrados también

- [x] 🔴 **7.2.6** Implementación `RouterAgent`
  - Recibe mensaje WhatsApp, contexto de conversación y herramientas disponibles
  - Mantiene `callCount` propio (por mensaje) — NO en `ToolExecutor`
  - Límite: 5 invocaciones de Tools por mensaje
  - Responde en el idioma del mensaje (detección automática o config del Tenant)
  - Escala a humano si: cliente pide hablar con persona, o 3 intentos sin resolver

- [x] 🔴 **7.2.7** Lógica de activación del RouterAgent
  - Solo activa si: no hay respuesta del recepcionista en 5 minutos Y dentro del horario de atención
  - Número no registrado: solo puede usar `getBusinessInformation`
  - Número registrado: puede usar todas las Tools

- [x] 🔴 **7.2.8** Manejo de fallback completo
  - Si LLM falla: envía mensaje predefinido al cliente + notifica RECEPTIONIST
  - Mensajes de fallback configurables por Tenant en `tenants.business_hours` (JSONB)

**Acceptance Criteria**:
- RouterAgent NO se activa si el recepcionista respondió en los últimos 5 minutos
- RouterAgent NO se activa fuera del horario de atención configurado
- Número desconocido solo puede obtener información general (no estados de órdenes)
- Si DeepSeek falla, el agente reintenta con Groq sin interrumpir la conversación
- Si ambos LLMs fallan, el cliente recibe un mensaje de fallback en ≤ 3 segundos
- El `callCount` no persiste entre mensajes diferentes del mismo usuario
- 6 invocaciones en un mismo mensaje disparan escalación al recepcionista
- Cada invocación de Tool queda registrada en log con duración en ms

---

## EPIC 8 — Dashboard, Notificaciones y Observabilidad

**Objetivo**: métricas en tiempo real, notificaciones WebSocket y observabilidad con Sentry.

### Feature 8.1 — Dashboard Operativo

**User Story**: Como dueño del taller, quiero ver métricas operativas en tiempo real para tomar decisiones fundamentadas.

#### Tasks

- [x] 🔴 **8.1.1** Use case `GetDashboardSummary`
  - Todas las queries en paralelo con `Promise.all`
  - Período por defecto: mes en curso
  - Retorna: WorkOrders activas por estado, cobrado del día, cobrado del mes, promedio ciclo, alertas stock, órdenes por vencer, ranking técnicos (top 5), tendencia ingresos 30 días, top 10 partes, alerta WAITING_PARTS > 5

- [x] 🔴 **8.1.2** Queries de Dashboard en los repositorios
  - `WorkOrderRepository.countActiveByStatus(branchId, tenantId)`
  - `WorkOrderRepository.avgCycleTime(branchId, tenantId, from, to)`
  - `WorkOrderRepository.technicianRanking(branchId, tenantId, from, to, limit)`
  - `WorkOrderRepository.findNearingDeadline(threshold, branchId, tenantId)`
  - `PaymentRepository.sumToday(branchId, tenantId)`
  - `PaymentRepository.sumByPeriod(branchId, tenantId, from, to)`
  - `PaymentRepository.incomeTrend(branchId, tenantId, days)`
  - `StockEntryRepository.topPartsByRotation(branchId, tenantId, from, to, limit)`

- [x] 🔴 **8.1.3** Endpoint `GET /api/dashboard/summary?branchId=&from=&to=`
  - Un solo endpoint que retorna todo el summary
  - Sin sub-endpoints separados

- [x] 🔴 **8.1.4** UI — Dashboard Principal (`/`)
  - Grid de KPI cards: cobrado hoy, cobrado mes, WOs activas, promedio ciclo
  - Alerta destacada si `WAITING_PARTS > 5`
  - Lista de WorkOrders próximas a vencer (rojo si ya venció)
  - Alertas de stock bajo (badge rojo en el número de items)
  - Gráfico de tendencia de ingresos (últimos 30 días) — librería: Recharts
  - Ranking top 5 técnicos con WOs completadas
  - Top 10 partes con mayor rotación
  - Selector de Branch para OWNER con acceso multi-sucursal
  - Date range picker para filtros
  - Polling cada 60 segundos con `refetchInterval` de React Query

- [x] 🟡 **8.1.5** Job `DeliveryAlertsScheduler`
  - `@Cron('*/30 * * * *')` via `@nestjs/schedule`
  - Busca WorkOrders con `promisedDeliveryAt <= NOW() + 2h` y status no terminal
  - Para cada una: envía WhatsApp al cliente + notifica OWNER y ADMIN

**Acceptance Criteria**:
- Dashboard carga en ≤ 1 segundo (todas las queries en paralelo)
- Período por defecto es el mes en curso al cargar por primera vez
- Métricas financieras calculadas con `Payment.amount`, no `WorkOrder.total`
- Alerta de WAITING_PARTS > 5 es visible y destacada
- Dashboard es usable en móvil de 375px de ancho

---

### Feature 8.2 — Notificaciones en Tiempo Real

**User Story**: Como recepcionista o técnico, quiero recibir notificaciones del sistema en tiempo real sin recargar la página.

#### Tasks

- [x] 🔴 **8.2.1** Implementar `NotificationsGateway` (WebSocket)
  - `@WebSocketGateway` namespace `/notifications`
  - Al conectar: unirse a sala `user:{userId}` y `tenant:{tenantId}`
  - Enviar notificaciones pendientes al reconectar (sin duplicados)

- [x] 🔴 **8.2.2** Implementar `NotificationPort`
  - Interface: `notifyUser(userId, notification)`, `notifyAdmins(tenantId, payload)`

- [x] 🔴 **8.2.3** Persistencia de notificaciones
  - Guardar cada notificación en tabla `notifications` antes de enviar por WebSocket
  - Mantener las últimas 100 por usuario (limpiar las más antiguas)

- [x] 🔴 **8.2.4** Use cases: `DeliverNotification`, `MarkNotificationAsRead`, `GetNotificationHistory`, `GetUnreadCount`

- [x] 🔴 **8.2.5** Endpoints REST
  - `GET /api/notifications?page=&pageSize=`
  - `PATCH /api/notifications/:id/read`
  - `PATCH /api/notifications/read-all`
  - `GET /api/notifications/unread-count`

- [x] 🔴 **8.2.6** Triggers de notificaciones (llamados desde use cases):
  - WorkOrder próxima a vencer (≤ 2h): OWNER, ADMIN
  - WorkOrder asignada a técnico: TECHNICIAN asignado
  - Stock bajo: OWNER, ADMIN
  - Payment registrado: ADMIN
  - Mensaje WhatsApp sin responder 5 min: RECEPTIONIST

- [x] 🔴 **8.2.7** UI — Bell icon en navbar
  - Badge con conteo de no leídas
  - Dropdown con últimas 10 notificaciones
  - Enlace "Ver todas"
  - Click en notificación → marca como leída + navega al recurso

**Acceptance Criteria**:
- Notificación llega en ≤ 1 segundo al usuario destinatario
- Al reconectar WebSocket, las notificaciones pendientes llegan sin duplicarse
- Click en "marcar como leída" actualiza el badge inmediatamente
- TECHNICIAN no recibe notificaciones de stock bajo (solo OWNER/ADMIN)

---

### Feature 8.3 — Observabilidad con Sentry

**User Story**: Como desarrollador, quiero observabilidad completa para detectar incidentes en producción rápidamente.

#### Tasks

- [x] 🔴 **8.3.1** Configurar Sentry en NestJS backend
  - `@sentry/nestjs` inicializado en `main.ts`
  - Contexto: `tenant_id`, `branch_id`, `user_id`, `trace_id` en cada error

- [x] 🔴 **8.3.2** Configurar Sentry en Next.js frontend
  - `@sentry/nextjs` con `sentry.client.config.ts` y `sentry.server.config.ts`

- [x] 🔴 **8.3.3** `TraceIdInterceptor` propagado
  - UUID v4 por request HTTP
  - Header `X-Trace-Id` en respuestas
  - `AsyncLocalStorage` para propagar en logs y Sentry

- [x] 🔴 **8.3.4** Endpoint `GET /api/health`
  - Verifica: PostgreSQL, R2, Redis, BullMQ, Meta WhatsApp API
  - Retorna `{ status: 'ok' | 'degraded', ...componentStatuses }`

- [x] 🟡 **8.3.5** Slow query logging en Prisma
  - Queries > 1000ms → log estructurado JSON con trace_id

- [x] 🟡 **8.3.6** Captura de errores de integraciones externas
  - Meta WhatsApp, DeepSeek, Groq, Cloudflare R2 → capturar en Sentry con contexto

**Acceptance Criteria**:
- Error 500 en producción aparece en Sentry con `tenant_id` y `trace_id`
- `GET /api/health` retorna `degraded` si Redis está caído, sin romper la respuesta
- Slow query > 1000ms aparece en logs con la query completa y el trace_id

---

## EPIC 9 — Auditoría, Configuración y Calidad Final

**Objetivo**: log de auditoría inmutable, configuración por tenant, hardening de seguridad y tests.

### Feature 9.1 — Auditoría Inmutable

**User Story**: Como administrador, quiero un registro completo de todas las acciones del sistema para cumplimiento legal y resolución de disputas.

#### Tasks

- [x] 🔴 **9.1.1** Implementar `AuditLogInterceptor`
  - Aplica automáticamente a métodos POST, PUT, PATCH, DELETE
  - Captura `new_data` (respuesta HTTP)
  - `previous_data = null` para CREATE; captura manual en use cases críticos de UPDATE
  - No bloquea la respuesta (`.catch(() => {})`)
  - Sanitiza datos sensibles antes de guardar

- [x] 🔴 **9.1.2** Repository `AuditLogRepository`
  - Solo `create(entry)` — sin update ni delete
  - Índices: `(tenant_id, created_at DESC)`, `(entity_type, entity_id)`

- [x] 🟡 **9.1.3** Use case `QueryAuditLog`
  - Solo accesible para OWNER
  - Filtros: `entityType`, `entityId`, `userId`, `action`, `from`, `to`
  - Paginado

- [x] 🔴 **9.1.4** Endpoint `GET /api/audit`
  - Solo para OWNER (verificado con `@RequirePermission('audit:READ')`)

- [x] 🟡 **9.1.5** UI — Log de Auditoría (`/audit`)
  - Tabla con filtros avanzados
  - Solo visible para OWNER

**Acceptance Criteria**:
- Cada POST/PUT/PATCH/DELETE genera un registro en `audit_logs`
- ADMIN no puede acceder a `GET /api/audit` (retorna 403)
- Los registros de auditoría no pueden ser eliminados por ningún usuario
- `auth_failure_logs` captura intentos fallidos con IP y timestamp

---

### Feature 9.2 — Configuración del Tenant

**User Story**: Como administrador del taller, quiero personalizar la configuración de mi taller para adaptar el software a mis procesos.

#### Tasks

- [x] 🔴 **9.2.1** UI — Configuración del Taller (`/settings`)
  - Sección "Perfil": nombre, NIT, dirección, teléfono, email
  - Sección "Logo": upload de imagen → sube a R2 `/{tenant_id}/logos/logo.{ext}`, reemplaza anterior
  - Sección "Impuesto": porcentaje de IVA (default 19%)
  - Sección "WhatsApp": número, token (cifrado al guardar), horario de atención
  - Sección "Mensajes automáticos": plantillas editables con variables dinámicas
  - Sección "Período contable": día de inicio del mes

- [x] 🔴 **9.2.2** Use case `UpdateTenantConfig`
  - `whatsapp_token` → `FieldEncryptionService.encrypt()` antes de persistir

- [x] 🟡 **9.2.3** Use case `UpdateTenantLogo`
  - Sube nuevo logo a R2
  - Elimina logo anterior de R2 (único caso de eliminación física permitido)
  - Actualiza `Tenant.logoUrl`

**Acceptance Criteria**:
- `whatsapp_token` guardado en BD está cifrado (no legible en claro)
- Actualizar logo reemplaza el archivo anterior en R2
- Variables dinámicas en plantillas WhatsApp (`{customer_name}`, etc.) se validan al guardar

---

### Feature 9.3 — Tests y Calidad Final

**User Story**: Como desarrollador, quiero coverage de tests suficiente para refactorizar con confianza.

#### Tasks

- [x] 🔴 **9.3.1** Unit tests — Entidades de dominio
  - `WorkOrder.transitionTo()`: todas las transiciones válidas e inválidas
  - `PartBranchStock.reserve()`, `releaseReservation()`, `confirmDiscount()`
  - `ServiceCatalogItem.deactivate()`, `update()`
  - `Quote` — transiciones de estado

- [x] 🔴 **9.3.2** Unit tests — Use cases críticos (con mocks de repositorios)
  - `AuthenticateUser`: credenciales válidas, inválidas, usuario inactivo
  - `TransitionWorkOrderStatus`: DELIVERED confirma stock, CANCELLED libera stock
  - `AddPartToWorkOrder`: stock suficiente vs insuficiente
  - `RegisterPayment`: amount inválido

- [x] 🔴 **9.3.3** Unit tests — Infraestructura de auth
  - `JwtService.verify()`: token expirado, inválido, válido
  - `PasswordService`: hash → verify ciclo completo
  - `ToolExecutor`: límite de callCount, timeout de Tool

- [x] 🟡 **9.3.4** Integration tests — Flujos críticos (Jest + Supertest + Neon dev branch)
  - Login → obtener token → crear WorkOrder → transicionar estados → DELIVERED
  - Registro de Part → agregar a WorkOrder → verificar `stock_reservado`
  - Crear Quote → Aprobar → WorkOrder → IN_PROGRESS automáticamente

- [x] 🟡 **9.3.5** Hardening de seguridad
  - Verificar que ningún endpoint retorna datos de otro tenant
  - Verificar que TECHNICIAN no ve WorkOrders de otros técnicos
  - Verificar rate limiting en `/api/auth/login`
  - Verificar que webhook sin firma retorna 401

**Acceptance Criteria**:
- `pnpm test:ci` pasa sin errores
- Coverage de entidades de dominio > 90%
- Coverage de use cases críticos > 80%
- Ningún endpoint retorna datos de otro tenant en los tests de integración

---

## Resumen de Dependencias por Epic

```
Epic 1 (Fundamentos)        → sin dependencias
  ↓
Epic 2 (Identity & Auth)    → requiere Epic 1
  ↓
Epic 3 (Customers)          → requiere Epic 2
  ↓
Epic 4 (Workshop)           → requiere Epic 3
  ↓
Epic 5 (Inventory)          → requiere Epic 4
Epic 6 (Commerce)           → requiere Epic 4
  ↓
Epic 7 (WhatsApp & AI)      → requiere Epic 4 + Epic 6
  ↓
Epic 8 (Dashboard)          → requiere Epic 5 + Epic 6 + Epic 7
  ↓
Epic 9 (Audit & Config)     → requiere Epic 8 (cierre del MVP)
```

---

## Conteo de Tareas

| Epic | Tareas 🔴 Bloqueantes | Tareas 🟡 Alta | Tareas 🟢 Normal | Total |
|------|----------------------|----------------|------------------|-------|
| Epic 1 — Fundamentos | 6 | 3 | 2 | 11 |
| Epic 2 — Identity & Auth | 16 | 10 | 0 | 26 |
| Epic 3 — Clientes & Vehículos | 16 | 4 | 0 | 20 |
| Epic 4 — Workshop | 22 | 3 | 0 | 25 |
| Epic 5 — Inventario | 18 | 2 | 0 | 20 |
| Epic 6 — Commerce | 16 | 2 | 0 | 18 |
| Epic 7 — WhatsApp & AI | 20 | 0 | 0 | 20 |
| Epic 8 — Dashboard | 14 | 3 | 0 | 17 |
| Epic 9 — Audit & Calidad | 9 | 6 | 0 | 15 |
| **TOTAL** | **137** | **33** | **2** | **172** |

---

*Última actualización: Fase 1 MVP — equipo de un desarrollador.*  
*Sprints estimados: 8-10 semanas trabajando a ritmo sostenible.*

## Notes

- **Autenticación**: implementación manual con `jsonwebtoken` + `bcrypt`. Sin `@nestjs/passport`, sin `@nestjs/jwt`.
- **BullMQ**: solo la cola `whatsapp-outbound`. PDFs síncronos con `@react-pdf/renderer`. Alertas con `@nestjs/schedule`.
- **Domain Events**: eliminados de Fase 1. Los use cases llaman directamente a los ports sin indirección de eventos.
- **InvoiceProvider (DIAN)**: fuera de Fase 1. Solo el comentario `// TODO Fase 2` en `commerce.module.ts`.
- **Paginación**: offset exclusivamente (`page` + `pageSize`). Sin cursor-based pagination.
- **Tenant isolation**: garantizado en los repositorios (siempre `tenantId` en WHERE), no via guard HTTP separado.
- **ToolExecutor**: completamente stateless. El `callCount` vive en el `RouterAgent` por conversación.
- **Precios históricos**: `unitPriceAtSale` en `WorkOrderPart` es inmutable tras creación.
- **Soft delete**: Customers, Vehicles, WorkOrders — campo `deleted_at`. Los archivos R2 NO se eliminan físicamente.
- **Fase 2 pendiente**: InvoiceProvider (DIAN), agentes especializados, Redis adapter Socket.IO, previous_data en AuditLog.
