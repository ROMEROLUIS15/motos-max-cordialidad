# Implementation Plan — Fase 2: Sistema Multiagente

## Overview

**Diseño actualizado:** La Fase 2 se implementa en 3 fases secuenciales:

1. **Fase 2A**: Crear endpoints REST en NestJS con autenticación service-to-service
2. **Fase 2B**: Implementar microservicio Python (`apps/agents/`) que consume esos endpoints
3. **Fase 2C**: Integración completa con WhatsApp routing y cron jobs coordinados

**Problemas originales resueltos:**

- ✅ Organiza tareas en 3 fases secuenciales
- ✅ Especifica dependencias críticas: 2A debe completarse antes de 2B
- ✅ Incluye tareas para modificar NestJS existente (JWTPayload, ServiceAuthGuard)
- ✅ Define endpoints REST que deben existir antes de implementar Python
- ✅ Planifica cron jobs coordinados entre servicios
- ✅ Establece criterios de aceptación para cada fase

---

## Convenciones

- `[ ]` Tarea pendiente
- `[x]` Tarea completada
- 🔴 Bloqueante · 🟡 Alta · 🟢 Normal
- **Dependencias**: F2-1.1 → F2-1.2 indica que F2-1.1 debe completarse antes de F2-1.2

---

# FASE 2A: ENDPOINTS REST EN NESTJS

**Objetivo:** Crear endpoints REST que el microservicio Python pueda consumir, con autenticación service-to-service.

**Dependencia crítica:** Esta fase DEBE completarse antes de Fase 2B. El microservicio Python no puede implementarse sin estos endpoints.

---

## EPIC 2A-1 — Autenticación Service-to-Service

**Objetivo:** Extender JWT y crear guards para autenticación de servicios internos.

### Tasks

- [ ] 🔴 **2A-1.1** Extender interface JWTPayload

  - Modificar `application/ports/jwt.port.ts`
  - Agregar campo opcional `type?: "user" | "service"` (NO romper el shape actual `{ sub, tenantId, branchId, roleId }`)
  - El claim `type:"service"` es lo único que distingue al servicio — **NO** usar roles falsos en `roleId` (sigue siendo el UUID real de la tabla `Role`; enum `SystemRole` no tiene `INTERNAL`)
  - Mantener backward compatibility con Fase 1

- [ ] 🔴 **2A-1.2** Crear ServiceAuthGuard

  - `presentation/http/guards/service-auth.guard.ts`
  - Valida **únicamente** `type === "service"` (no consulta la tabla `Role` ni pasa por `PermissionGuard`)
  - Reutiliza la verificación de firma de `JwtService` existente (no hace falta modificar `verify()`)

- [ ] 🔴 **2A-1.3** Crear utilidad para generar tokens de servicio
  - `application/services/token-factory.service.ts`
  - Método `createServiceToken()` → `{ sub:"agents-service", type:"service" }` (el `tenantId` va explícito por request, NO en el token)
  - Firma con el mismo `JWT_SECRET`
  - Expiración corta: 5 minutos

**Acceptance Criteria:**

- Tokens existentes de Fase 1 siguen funcionando sin cambios
- ServiceAuthGuard rechaza tokens de usuario normal
- ServiceAuthGuard acepta tokens con `type: "service"` (sin importar `roleId`)
- Los tokens de servicio no requieren buscar usuario en BD

---

## EPIC 2A-2 — Controladores y Endpoints REST

**Objetivo:** Crear endpoints que el microservicio Python necesitará.

### Tasks

- [ ] 🔴 **2A-2.1** Crear `AgentsController`

  - `presentation/http/controllers/agents.controller.ts`
  - Decorador `@UseGuards(ServiceAuthGuard)`
  - Base path `/api/agents`
  - Versión inicial con endpoints de prueba

- [ ] 🔴 **2A-2.2** Endpoint: Listar tenants activos

  - `GET /api/agents/tenants`
  - Protegido por `ServiceAuthGuard` (token `type:"service"`)
  - Retorna lista de tenants con `status: "ACTIVE"`
  - Usar `TenantRepository` existente

- [ ] 🔴 **2A-2.3** Endpoint: Dashboard para agentes

  - `GET /api/agents/dashboard/summary`
  - Protegido por `ServiceAuthGuard` (token `type:"service"`)
  - Parámetros: `periodStart`, `periodEnd`, `branchId?`
  - Retorna: ingresos totales, órdenes completadas, ticket promedio

- [ ] 🔴 **2A-2.4** Endpoint: Inventario para agentes

  - `GET /api/agents/inventory/status`
  - Protegido por `ServiceAuthGuard` (token `type:"service"`)
  - Parámetros: `tenantId`, `branchId?`, `daysLookback?`
  - Retorna: stock crítico, rotación, días restantes estimados

- [ ] 🔴 **2A-2.5** Endpoint: Crear borrador orden de compra

  - `POST /api/agents/purchase-orders/draft`
  - Protegido por `ServiceAuthGuard` (token `type:"service"`)
  - Body: `{ tenantId, items: [{partId, quantity, reason}] }`
  - Crea registro en tabla nueva `purchase_order_drafts`

- [ ] 🔴 **2A-2.6** Endpoint: Notificación in-app de stock

  - `POST /api/agents/notifications/stock-alert`
  - Protegido por `ServiceAuthGuard` (token `type:"service"`)
  - Body: `{ tenantId, partId, partName, currentStock, minStock }`
  - Crea notificación in-app (tabla `notifications`, `type:"STOCK_ALERT"`) para el OWNER del tenant
  - ⚠️ Hoy `notifications` solo expone GET/marcar-leído; este endpoint es el **POST de creación** que falta

- [ ] 🔴 **2A-2.7** Endpoints de reportes, órdenes pendientes y WhatsApp proactivo
  - `GET  /api/agents/work-orders/pending` — órdenes activas/demoradas (`?tenantId`)
  - `POST /api/agents/reports` — registra un reporte generado (tras subir el PDF a R2)
  - `POST /api/agents/reports/generate` — dispara generación bajo demanda
  - `POST /api/agents/notifications/whatsapp` — `{ tenantId, content }` → resuelve el teléfono del OWNER y envía
    - ⚠️ El `POST /api/messages/send` existente **NO sirve**: su contrato es `{ sessionId, content }` y exige sesión activa + JWT de usuario
  - `GET /api/reports` + `GET /api/reports/:id/download` — para la web (`JwtAuthGuard`, OWNER/ADMIN)

**Acceptance Criteria:**

- `GET /api/agents/tenants` requiere token de servicio (`type:"service"`) y rechaza tokens de usuario
- `GET /api/agents/dashboard/summary` retorna datos reales de BD
- `GET /api/agents/inventory/status` calcula rotación correctamente
- `POST /api/agents/purchase-orders/draft` crea registro en BD
- `POST /api/agents/notifications/stock-alert` envía WhatsApp en ≤ 30s

---

## EPIC 2A-3 — Migraciones Prisma

**Objetivo:** Crear tablas nuevas para Fase 2.

### Tasks

- [ ] 🔴 **2A-3.1** Tabla `reports`

  - Agregar modelo `Report` a `schema.prisma`
  - Campos: `id, tenantId, type, periodStart, periodEnd, pdfR2Key, status, generatedAt`
  - `prisma migrate dev --name add_reports_table`

- [ ] 🔴 **2A-3.2** Tabla `home_service_requests`

  - Agregar modelo `HomeServiceRequest` a `schema.prisma`
  - Campos: `id, tenantId, branchId, customerId?, customerName, customerPhone, address, problemDesc, serviceType, status, assignedTo?, workOrderId?, estimatedCost?`
  - `prisma migrate dev --name add_home_service_requests`

- [ ] 🔴 **2A-3.3** Tabla `purchase_order_drafts`
  - Agregar modelo `PurchaseOrderDraft` a `schema.prisma`
  - Campos: `id, tenantId, status, items (JSONB), notes, createdBy, approvedBy, approvedAt`
  - `prisma migrate dev --name add_purchase_order_drafts`

**Acceptance Criteria:**

- Las 3 migraciones se aplican sin errores
- Las tablas tienen relaciones correctas con `Tenant`
- Los modelos tienen todos los campos del diseño

---

## EPIC 2A-4 — Tool de Servicio a Domicilio

**Objetivo:** Extender el RouterAgent de Fase 1 para capturar solicitudes de domicilio.

### Tasks

- [ ] 🔴 **2A-4.1** Crear tool `createHomeServiceRequest`

  - `infrastructure/ai/tools/implementations/create-home-service-request.tool.ts`
  - Schema: `customerName, customerPhone, address, problemDesc, serviceType`
  - Llama a endpoint interno `POST /api/home-services`

- [ ] 🔴 **2A-4.2** Endpoints públicos `HomeServicesController`

  - `presentation/http/controllers/home-services.controller.ts`
  - `GET /api/home-services` (lista, filtros por status)
  - `POST /api/home-services` (crear desde tool)
  - `PATCH /api/home-services/:id/assign` (asignar técnico)
  - `PATCH /api/home-services/:id/status` (cambiar estado)

- [ ] 🔴 **2A-4.3** Notificación automática al taller
  - Al crear solicitud: notificación en plataforma + WhatsApp al taller
  - Al asignar técnico: WhatsApp al cliente con nombre y tiempo estimado
  - Usar `NotificationPort` existente de Fase 1

**Acceptance Criteria:**

- Cliente escribe "mi moto se quedó varada en [dirección]" → tool captura todos los campos
- Solicitud aparece en plataforma web en ≤ 30 segundos
- Al asignar técnico, cliente recibe WhatsApp automático
- Fuera de horario → mensaje "Estamos fuera de horario..." y creación para día siguiente

---

# FASE 2B: MICROSERVICIO PYTHON

**Objetivo:** Implementar el microservicio Python con LangGraph que consume endpoints de Fase 2A.

**Dependencia crítica:** Requiere que Fase 2A esté completa y los endpoints funcionen.

---

## EPIC 2B-1 — Infraestructura Python

**Objetivo:** Tener el microservicio Python corriendo en Docker.

### Tasks

- [ ] 🔴 **2B-1.1** Crear estructura base `apps/agents/`

  - `pyproject.toml` con dependencias: `fastapi`, `uvicorn`, `langgraph`, `langchain`, `langchain-openai`, `redis`, `httpx`, `pydantic-settings`, `apscheduler`, `pandas`, `sentry-sdk`
  - `Dockerfile` Python 3.12 slim
  - `src/main.py` con FastAPI app básica
  - `src/config.py` con pydantic-settings leyendo `.env.local`

- [ ] 🔴 **2B-1.2** Integrar en `docker-compose.yml`

  - Agregar servicio `agents` en puerto 8000
  - Network compartida `motoworkshop-net`
  - `depends_on: redis, api`
  - Variables de entorno: `API_BASE_URL`, `JWT_SECRET`, `DEEPSEEK_API_KEY`, `GROQ_API_KEY`

- [ ] 🔴 **2B-1.3** `GET /health` endpoint

  - Verifica conexión a Redis
  - Verifica conexión a NestJS API (`GET /api/health`)
  - Retorna `{ status: "ok" | "degraded", redis: bool, api: bool }`

- [ ] 🔴 **2B-1.4** Cliente HTTP `saas_client.py`
  - httpx async client apuntando a `API_BASE_URL`
  - Auth: genera token de servicio (`type:"service"`); el `tenantId` va explícito por request
  - Métodos: `get_inventory_status()`, `get_sales_summary()`, etc.
  - Retry automático: 2 intentos con backoff

**Acceptance Criteria:**

- `docker-compose up` levanta `agents` en puerto 8000 sin errores
- `GET localhost:8000/health` retorna `{ status: "ok" }`
- `saas_client` puede autenticarse con tokens de servicio
- Los endpoints de Fase 2A responden al cliente Python

---

## EPIC 2B-2 — AgentAdmin Core (LangGraph)

**Objetivo:** AgentAdmin responde preguntas libres del admin.

### Tasks

- [ ] 🔴 **2B-2.1** Definir `AdminAgentState`

  - `src/agents/admin/state.py`
  - TypedDict: `messages, tenant_id, admin_phone, session_id, tool_call_count, intent, final_response`
  - Anotaciones para `add_messages` de LangGraph

- [ ] 🔴 **2B-2.2** Construir grafo LangGraph

  - `src/agents/admin/agent.py`
  - Nodos: `classify_intent`, `execute_tool`, `respond`, `fallback`
  - Checkpoint con `MemorySaver` (in-process); la sesión persiste vía `memory.py` sobre Redis (NO se usa `langgraph-checkpoint-redis`)
  - Compilar con `StateGraph`

- [ ] 🔴 **2B-2.3** Nodo `classify_intent`

  - Clasifica mensaje en: `SALES_QUERY`, `INVENTORY_QUERY`, `REPORT_REQUEST`, `GENERAL`
  - Usa LLM con prompt estructurado
  - Retorna intent + tool sugerida

- [ ] 🔴 **2B-2.4** Nodo `execute_tool`

  - Ejecuta tool según intent
  - Llama a `saas_client` para obtener datos
  - Timeout 10s por tool
  - Incrementa `tool_call_count`; límite de 5

- [ ] 🔴 **2B-2.5** Nodo `respond`

  - Genera respuesta en lenguaje natural
  - Español colombiano
  - Máximo 300 palabras para WhatsApp
  - Si hay reporte → incluye "disponible en plataforma"

- [ ] 🔴 **2B-2.6** Nodo `fallback`
  - Se activa si LLM falla o `tool_call_count > 5`
  - Mensaje predefinido: "No pude completar el análisis ahora..."
  - Registra en Sentry

**Acceptance Criteria:**

- Admin escribe "¿cuánto vendí esta semana?" → respuesta en ≤ 15s
- Mantiene contexto conversacional por 2 horas (Redis session)
- Si supera 5 tool calls → responde con lo que tiene
- Si LLM falla → mensaje de fallback + Sentry

---

## EPIC 2B-3 — Tools del AgentAdmin

**Objetivo:** Implementar tools que consumen endpoints NestJS.

### Tasks

- [ ] 🔴 **2B-3.1** Tool `get_inventory_status`

  - `src/tools/inventory_tools.py`
  - Llama `GET /api/agents/inventory/status`
  - Calcula rotación de últimos 30 días
  - Retorna: críticos, días restantes, sugerencia de cantidad

- [ ] 🔴 **2B-3.2** Tool `get_sales_summary`

  - `src/tools/sales_tools.py`
  - Llama `GET /api/agents/dashboard/summary`
  - Retorna: ingresos, órdenes, ticket promedio, top servicios

- [ ] 🔴 **2B-3.3** Tool `prepare_purchase_order`

  - `src/tools/order_tools.py`
  - Llama `POST /api/agents/purchase-orders/draft`
  - Crea borrador con repuestos críticos
  - Retorna ID del borrador para seguimiento

- [ ] 🔴 **2B-3.4** Tool `trigger_report_generation`
  - `src/tools/report_tools.py`
  - Llama endpoint interno para generar reporte async
  - Retorna mensaje: "Tu reporte estará listo en 1-2 minutos"

**Acceptance Criteria:**

- Todas las tools usan pydantic para validación de inputs
- Timeout de 10s por tool
- Retry automático en fallos de red
- Registran duración y resultado en logs estructurados

---

## EPIC 2B-4 — Reportes Automáticos

**Objetivo:** Generación de reportes semanales y mensuales.

### Tasks

- [ ] 🔴 **2B-4.1** `report_generator.py` — orquestador

  - `generate_weekly_report(tenant_id, week_start, week_end)`
  - `generate_monthly_report(tenant_id, month, year)`
  - Consulta datos via `saas_client` → calcula métricas con pandas → genera PDF → sube a R2 → registra en BD → notifica

- [ ] 🔴 **2B-4.2** Template reporte semanal

  - `src/reports/templates/weekly.py`
  - Secciones: resumen ejecutivo, órdenes, ingresos, técnico más productivo, repuestos más usados, stock crítico
  - Generado con `reportlab`

- [ ] 🔴 **2B-4.3** Template reporte mensual

  - `src/reports/templates/monthly.py`
  - Todo lo del semanal +
  - Tendencia vs mes anterior (gráfico matplotlib)
  - Margen por categoría
  - Clientes nuevos vs recurrentes
  - Top 10 repuestos por rotación y margen

- [ ] 🔴 **2B-4.4** `uploader.py` — subida a R2
  - Ruta: `/{tenant_id}/reports/{type}/{year}/{filename}.pdf`
  - Usa boto3 con credenciales existentes de R2
  - Genera URL pre-firmada (7 días)

**Acceptance Criteria:**

- PDF generado con logo del tenant y período correcto
- Datos reales de BD (no mock)
- PDF subido a R2 en ≤ 60 segundos
- URL pre-firmada funciona por 7 días

---

## EPIC 2B-5 — Alertas de Stock

**Objetivo:** Alertas proactivas con throttle de 24 horas.

### Tasks

- [ ] 🔴 **2B-5.1** Job APScheduler cada hora

  - `src/schedulers/stock_alert.py`
  - Lista tenants activos via `GET /api/agents/tenants`
  - Para cada tenant: verifica stock bajo

- [ ] 🔴 **2B-5.2** Throttle con Redis

  - Key: `alert:stock:{tenant_id}:{part_id}` TTL 24h
  - Si key existe → no envía alerta (evita spam)
  - Si no existe → envía alerta → crea key

- [ ] 🔴 **2B-5.3** Mensaje de alerta
  - Incluye: nombre repuesto, SKU, stock actual, stock mínimo, sugerencia de cantidad
  - Enviado via `POST /api/agents/notifications/stock-alert`
  - También aparece en plataforma (bell icon)

**Acceptance Criteria:**

- Alerta llega en ≤ 1 hora después de caer bajo mínimo
- No llega spam: máximo 1 alerta por repuesto cada 24h
- Mensaje incluye datos útiles para tomar decisión
- También aparece en plataforma web

---

## EPIC 2B-6 — LLM Factory

**Objetivo:** DeepSeek con fallback a Groq.

### Tasks

- [ ] 🔴 **2B-6.1** Factory con fallback

  - `src/agents/shared/llm_factory.py`
  - Intenta DeepSeek primero (timeout 10s)
  - Si falla → Groq (timeout 10s)
  - Si ambos fallan → excepción `AllLLMProvidersFailedException`

- [ ] 🔴 **2B-6.2** Prompt engineering
  - `src/agents/admin/prompts.py`
  - System prompt en español colombiano
  - Instrucciones claras: máximo 300 palabras, no inventar datos, humilde cuando no sepa
  - Templates para clasificación, respuesta, fallback

**Acceptance Criteria:**

- DeepSeek es provider por defecto
- Fallback a Groq funciona sin interrupción
- Los prompts generan respuestas apropiadas para WhatsApp
- Logs muestran qué provider se usó por mensaje

---

# FASE 2C: INTEGRACIÓN COMPLETA

**Objetivo:** Conectar todos los componentes, routing de WhatsApp, cron jobs coordinados.

**Dependencia crítica:** Requiere que Fase 2A y 2B estén completas.

---

## EPIC 2C-1 — Routing de WhatsApp

**Objetivo:** Identificar si mensaje viene de admin y reenviar a Python.

### Tasks

- [ ] 🔴 **2C-1.1** Método `findOwnerByWhatsappPhone`

  - Agregar a `UserRepository` interface
  - Implementación: busca usuario con rol OWNER y `whatsappPhone` coincidente

- [ ] 🔴 **2C-1.2** Modificación en `process-incoming-message.use-case.ts`

  - ~15 líneas nuevas
  - Verifica si número es admin
  - Si es admin → `POST http://agents:8000/agents/admin`
  - Si agents no disponible → escala a recepcionista humano

- [ ] 🔴 **2C-1.3** Endpoint `POST /agents/admin`
  - `src/api/admin_handler.py`
  - Recibe: `{ message, phoneNumber, tenantId }`
  - Busca o crea sesión Redis
  - Ejecuta grafo LangGraph
  - Llama a NestJS para enviar respuesta por WhatsApp

**Acceptance Criteria:**

- Admin escribe por WhatsApp → mensaje llega a Python → respuesta en ≤ 15s
- Cliente escribe → mensaje va a RouterAgent de NestJS (sin cambios)
- Si agents no disponible → admin no queda sin respuesta (escala a humano)
- Los logs muestran routing correcto

---

## EPIC 2C-2 — Cron Jobs Coordinados

**Objetivo:** Reportes automáticos que funcionan para todos los tenants.

### Tasks

- [ ] 🔴 **2C-2.1** Scheduler principal

  - `src/schedulers/scheduler.py`
  - APScheduler con timezone `America/Bogota`
  - Jobs: semanal (lunes 8am), mensual (día 1 del mes 8am), stock (cada hora)

- [ ] 🔴 **2C-2.2** Job semanal de reportes

  - `src/schedulers/weekly_report.py`
  - Obtiene lista de tenants activos via `GET /api/agents/tenants`
  - Para cada tenant: genera reporte de semana anterior
  - Si falla un tenant → continúa con los demás

- [ ] 🔴 **2C-2.3** Job mensual de reportes

  - `src/schedulers/monthly_report.py`
  - Similar al semanal pero para mes calendario anterior
  - Incluye gráficos y análisis adicionales

- [ ] 🔴 **2C-2.4** Job de stock alerts
  - `src/schedulers/stock_alert.py`
  - Cada hora revisa todos los tenants
  - Throttle de 24 horas por repuesto

**Acceptance Criteria:**

- Reporte semanal se genera cada lunes 8am Colombia
- Reporte mensual se genera día 1 del mes 8am Colombia
- Si falla un tenant, no afecta a los demás
- Logs muestran qué tenants se procesaron y cuáles fallaron

---

## EPIC 2C-3 — Plataforma Web (Next.js)

**Objetivo:** Nuevas páginas para reportes y servicios a domicilio.

### Tasks

- [ ] 🔴 **2C-3.1** Página `/reports`

  - Lista reportes generados con tipo, período, fecha, estado
  - Botón de descarga PDF para cada reporte listo
  - Preview inline del reporte más reciente
  - Filtros por tipo y rango de fechas
  - Solo para OWNER y ADMIN

- [ ] 🔴 **2C-3.2** Página `/home-services`

  - Tabla de solicitudes con columnas: cliente, dirección, tipo, estado, fecha
  - Filtros por estado y fecha
  - Modal de detalle con todos los campos
  - Botón "Asignar mecánico" → selector de técnicos
  - Badge de estado con colores

- [ ] 🔴 **2C-3.3** Página `/purchase-orders`
  - Lista de borradores generados por el agente
  - Botón "Aprobar" / "Rechazar"
  - Solo para OWNER y ADMIN

**Acceptance Criteria:**

- Admin puede descargar cualquier reporte desde `/reports`
- Recepcionista puede asignar mecánico en ≤ 3 clicks
- Listas se actualizan en tiempo real (polling cada 30s)
- Responsive en móvil (375px)

---

## EPIC 2C-4 — Variables de Entorno y Deploy

**Objetivo:** Todo configurado para producción.

### Tasks

- [ ] 🔴 **2C-4.1** Variables de entorno nuevas

  - `.env.local`: `AGENTS_BASE_URL`, `ADMIN_SESSION_TTL_SECONDS`, `TZ`
  - Documentar en `.env.local.example`

- [ ] 🔴 **2C-4.2** GitHub Actions — CI para Python

  - Job `test-agents`: `pytest` en `apps/agents/`
  - Job `typecheck-agents`: `mypy src/`
  - Job `lint-agents`: `ruff check src/`
  - Se ejecuta en paralelo con jobs existentes

- [ ] 🔴 **2C-4.3** Deploy en Render/Railway

  - Agregar servicio `agents` en la plataforma de deploy
  - Variables de entorno de producción configuradas
  - `AGENTS_BASE_URL` en NestJS apunta al servicio en producción

- [ ] 🟡 **2C-4.4** Tests de integración end-to-end
  - Admin envía mensaje → NestJS rutea → Python procesa → respuesta llega
  - Solicitud de domicilio → notificación → asignación → notificación al cliente

**Acceptance Criteria:**

- `docker-compose up` levanta todo el stack sin errores
- Pipeline de CI pasa para Python y TypeScript
- Servicio Python desplegado en producción
- Tests de integración pasan

---

## Conteo de Tareas por Fase

| Fase                     | Bloqueantes 🔴 | Alta 🟡 | Total  |
| ------------------------ | -------------- | ------- | ------ |
| **Fase 2A: NestJS**      | 16             | 0       | 16     |
| **Fase 2B: Python**      | 16             | 0       | 16     |
| **Fase 2C: Integración** | 11             | 1       | 12     |
| **TOTAL**                | **43**         | **1**   | **44** |

---

## Dependencias Críticas

### Fase 2A DEBE completarse antes de Fase 2B:

1. ✅ ServiceAuthGuard funciona
2. ✅ Endpoints REST (`/api/agents/*`) responden
3. ✅ Migraciones Prisma aplicadas
4. ✅ Tool de servicio a domicilio funciona

### Fase 2B DEBE completarse antes de Fase 2C:

1. ✅ Microservicio Python levantado (`docker-compose up`)
2. ✅ AgentAdmin responde a preguntas de prueba
3. ✅ Reportes generados manualmente funcionan
4. ✅ Alertas de stock con throttle funcionan

### Secuencia obligatoria:

```
Fase 2A → Fase 2B → Fase 2C
   ↓         ↓         ↓
NestJS    Python    Integración
Endpoints  Agent    WhatsApp
```

---

## Notas Técnicas

### Autenticación Service-to-Service

- Token JWT con claim: `{ sub: "agents-service", type: "service" }` (sin rol; el `tenantId` va explícito por request)
- Firmado con el mismo `JWT_SECRET` de Fase 1
- Expiración corta: 5 minutos (se regenera por cada request)
- `ServiceAuthGuard` solo valida firma y `type === "service"`, no busca user en BD ni pasa por `PermissionGuard`

### Comunicación entre Servicios

```
WhatsApp → NestJS (:3001) → Python (:8000) → NestJS (:3001) → BD
    │                                           │
    └──────────── Clientes ────────────────────┘
```

### Redis Keys Naming

- Sesiones admin: `agent:admin:{tenant_id}:{phone}` (gestionadas por `memory.py`)
- Throttle alertas: `alert:stock:{tenant_id}:{part_id}`
- (LangGraph usa `MemorySaver` in-process → NO hay key de checkpoint en Redis)

### Timezone

- Todos los cron jobs usan `America/Bogota` (UTC-5)
- Variable `TZ` en contenedores Docker
- Fechas en BD siempre UTC, conversión en aplicación

### LLM Providers

- Primario: DeepSeek (via langchain-openai con `base_url`)
- Secundario: Groq (fallback)
- Ambos son OpenAI-compatible, mismo adapter

### PDF Generation

- Reportes semanales: texto simple con reportlab
- Reportes mensuales: incluyen gráficos matplotlib
- Subida a R2 con boto3 (mismas credenciales de Fase 1)

---

## Criterios de Éxito por Fase

### Fase 2A Completada:

- ✅ ServiceAuthGuard protege endpoints `/api/agents/*`
- ✅ Python puede autenticarse con tokens de servicio
- ✅ Endpoints retornan datos reales de BD
- ✅ Migraciones aplicadas sin errores

### Fase 2B Completada:

- ✅ `docker-compose up` levanta Python en puerto 8000
- ✅ AgentAdmin responde preguntas de prueba localmente
- ✅ Reportes se generan manualmente y suben a R2
- ✅ Alertas de stock funcionan con throttle

### Fase 2C Completada:

- ✅ Admin escribe por WhatsApp → respuesta en ≤ 15s
- ✅ Cliente solicita domicilio → notificación al taller en ≤ 30s
- ✅ Reportes semanales se generan automáticamente cada lunes
- ✅ Plataforma web muestra reportes y solicitudes de domicilio

---

**Estado actual:** Fase 2A pendiente de inicio. Las tareas están secuenciadas correctamente con dependencias críticas identificadas.
