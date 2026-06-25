# Roadmap — MotoWorkshop SaaS

---

## Visión General

```
Fase 1          Fase 2              Fase 3
────────────    ────────────────    ──────────────────────
Operación       Agentes IA          Expansión Comercial
del taller   →  especializados   →  y Plataforma
(MVP)           + Analytics+        Multi-concesionario
```

---

## Fase 1 — MVP Operacional

**Objetivo**: Digitalizar completamente la operación del primer taller cliente en Barranquilla.  
**Duración estimada**: 12-16 semanas  
**Cliente objetivo**: Taller de motocicletas, Barranquilla, Colombia

### Sprint 1 (Semanas 1-2): Fundamentos
- [ ] Setup del repositorio monorepo (NestJS backend + Next.js frontend)
- [ ] Configuración Docker (dev + prod)
- [ ] Setup Neon PostgreSQL + Prisma (schema inicial)
- [ ] Setup Redis + BullMQ
- [ ] Configuración Sentry (frontend + backend)
- [ ] CI/CD pipeline (GitHub Actions → Cloudflare Pages + Docker)
- [ ] Módulo Identity: Tenant, Branch, User, Role, Permission
- [ ] Autenticación JWT + Refresh Token
- [ ] Guards: JwtAuthGuard, TenantGuard, PermissionGuard
- [ ] Middleware de Audit Log (interceptor automático)

### Sprint 2 (Semanas 3-4): Clientes y Vehículos
- [ ] Módulo Customers: CRUD Customer
- [ ] Búsqueda de clientes (nombre, documento, teléfono, placa)
- [ ] Módulo Vehicles: CRUD Vehicle
- [ ] Transferencia de propietario
- [ ] Historial de Vehicle
- [ ] UI: Listado y ficha de cliente con vehículos asociados

### Sprint 3 (Semanas 5-6): Recepción y Órdenes de Trabajo
- [ ] Módulo Workshop: VehicleReception
- [ ] Subida de fotos de recepción (Cloudflare R2 + BullMQ compresión)
- [ ] WorkOrder: creación desde VehicleReception
- [ ] Máquina de estados de WorkOrder
- [ ] WorkOrderLines y WorkOrderParts
- [ ] UI: Formulario de recepción + creación de orden

### Sprint 4 (Semanas 7-8): Inventario
- [ ] Módulo Inventory: CRUD Part
- [ ] PartBranchStock (tres niveles: físico, reservado, disponible)
- [ ] StockEntries: ENTRADA, SALIDA, AJUSTE
- [ ] Reserva/liberación automática en WorkOrders
- [ ] Transferencias entre Branch
- [ ] Alertas de stock bajo
- [ ] UI: Listado de inventario, movimientos de stock

### Sprint 5 (Semanas 9-10): Comercio y Archivos
- [ ] Módulo Commerce: Quote (ciclo de vida completo)
- [ ] Generación de PDF (BullMQ async)
- [ ] Módulo Commerce: Payment (registro manual)
- [ ] Integración Cloudflare R2 completa
- [ ] URLs pre-firmadas 24h para todos los tipos
- [ ] PhotoEvidences en WorkOrders
- [ ] UI: Cotizaciones, pagos, evidencias fotográficas

### Sprint 6 (Semanas 11-12): WhatsApp + IA
- [ ] Módulo Messaging: integración Meta WhatsApp Cloud API
- [ ] Notificaciones automáticas (COMPLETED, WAITING_PARTS)
- [ ] Alertas de entrega próxima (BullMQ job)
- [ ] Envío manual de mensajes
- [ ] Módulo AI: RouterAgent + 6 Tools iniciales
- [ ] Fallback LLM: DeepSeek → Groq → mensaje predefinido
- [ ] UI: Bandeja de WhatsApp, configuración de plantillas

### Sprint 7 (Semanas 13-14): Dashboard + Notificaciones
- [ ] Módulo Dashboard: todos los widgets
- [ ] Métricas basadas en Payments registrados
- [ ] Módulo Notifications: WebSocket en tiempo real
- [ ] Notificaciones por evento (stock bajo, WorkOrder asignada, etc.)
- [ ] UI: Dashboard responsive (mobile 375px+)

### Sprint 8 (Semanas 15-16): Calidad y Lanzamiento
- [ ] Pruebas de integración end-to-end
- [ ] Pruebas de carga (50 usuarios concurrentes)
- [ ] Auditoría de seguridad: tenant isolation, SQL injection, rate limiting
- [ ] Configuración y personalización por Tenant (UI)
- [ ] Documentación de onboarding del primer cliente
- [ ] Despliegue en producción
- [ ] Capacitación al equipo del taller

### Entregables Fase 1

| Módulo | Estado |
|--------|--------|
| Identity & Auth | ✅ |
| Customers | ✅ |
| Vehicles | ✅ |
| VehicleReception | ✅ |
| WorkOrders | ✅ |
| Inventory (3 niveles de stock) | ✅ |
| Payments | ✅ |
| Quotes PDF | ✅ |
| PhotoEvidences | ✅ |
| WhatsApp básico | ✅ |
| RouterAgent (IA) | ✅ |
| Dashboard | ✅ |
| Notificaciones en tiempo real | ✅ |
| Auditoría inmutable | ✅ |
| Multi-tenant | ✅ |
| Multi-Branch | ✅ |
| Permisos por Rol | ✅ |
| Facturación DIAN | 🔲 (abstracción lista) |
| Venta de motos | 🔲 (entidades en dominio) |
| Panel SuperAdmin | 🔲 |

---

## Fase 2 — Agentes IA Especializados

**Objetivo**: Reducir la carga operativa manual con agentes especializados por dominio.  
**Duración estimada**: 8-12 semanas (post Fase 1)

### Nuevas Capacidades

**CommercialAgent**
- Responde consultas de ventas y disponibilidad de motocicletas (preparación para venta)
- Genera cotizaciones automáticas para servicios de alto volumen
- Seguimiento proactivo de Quotes en estado SENT sin respuesta

**WorkshopAgent**
- Sugiere asignación óptima de técnicos según carga actual y especialidad
- Detecta patrones en descripciones de problemas para sugerir ServiceType y tiempo estimado
- Alerta proactiva sobre WorkOrders con riesgo de incumplir `promised_delivery_at`

**FinancialAgent**
- Reportes financieros en lenguaje natural ("¿cuánto generé esta semana?")
- Análisis de rentabilidad por ServiceType, Technician y Part
- Proyecciones de flujo de caja basadas en WorkOrders activas

**ManagementAgent**
- Análisis de inventario: sugiere órdenes de compra basadas en rotación histórica
- Detección de anomalías: ajustes de inventario inusuales, patrones de cancelación
- Reportes de productividad de técnicos

### Nuevas Tools (Fase 2)

- `getOptimalTechnicianAssignment(serviceType, estimatedHours)`
- `generatePurchaseRecommendations(branchId, lookbackDays)`
- `getFinancialSummary(branchId, period)`
- `analyzeWorkOrderPatterns(vehicleId)`
- `getPendingQuoteFollowUps(tenantId)`

### Infraestructura Adicional

- Vector store para embeddings de historial de WorkOrders (búsqueda semántica)
- Memoria persistente de conversaciones por Customer (Redis con TTL configurable)
- Panel de monitoreo de agentes IA (invocaciones, latencias, tasas de escalación)

---

## Fase 3 — Expansión Comercial y Plataforma

**Objetivo**: Escalar a múltiples clientes en Latinoamérica y habilitar venta de motocicletas.  
**Duración estimada**: 16-24 semanas (post Fase 2)

### Venta de Motocicletas

- Módulo Sales: MotorcycleUnit (inventario nuevo/usado), SaleOrder
- Proceso de venta con Customer como prospecto/comprador
- Integración financiera: planes de pago, cuotas
- Documentación de venta: contrato, acta de entrega

### SupervisorAgent

- Orquestación multiagente para tareas complejas
- Ejemplo: "Quiero servicio + cambiar aceite + reprogramar seguro de mi Yamaha"
  → SupervisorAgent coordina WorkshopAgent + CommercialAgent + ManagementAgent
- Memoria compartida entre agentes para el contexto del Customer

### Facturación Electrónica DIAN

- Implementación de `InvoiceProvider` con proveedor DIAN certificado
- Facturación electrónica desde WorkOrders y SaleOrders
- Gestión de resoluciones y rangos de numeración

### Expansión Multi-País

- Configuración de IVA por país (Colombia 19%, México 16%, Perú 18%, etc.)
- Soporte de monedas: COP, MXN, PEN, CLP
- Adaptación de tipos de documento por país
- Panel SuperAdmin de la plataforma (alta de nuevos Tenants)

### Marketplace de Integraciones

- Integraciones con proveedores de repuestos (catálogo en línea)
- Integración con sistemas de seguros de motos
- API pública para integraciones de terceros

---

## Métricas de Éxito

### Fase 1

| Métrica | Target |
|---------|--------|
| Tiempo de creación de WorkOrder | < 3 minutos |
| Adopción por el equipo del taller | > 90% de órdenes en el sistema |
| Tiempo de respuesta API P95 lectura | < 500ms |
| Tiempo de respuesta API P95 escritura | < 1000ms |
| Uptime | > 99.5% |
| Tasa de escalación del RouterAgent | < 30% de conversaciones |
| Satisfacción del cliente (NPS) | > 40 |

### Fase 2

| Métrica | Target |
|---------|--------|
| Reducción en tiempo de respuesta WhatsApp | > 60% |
| WorkOrders con riesgo detectado proactivamente | > 80% |
| Tasa de adopción de sugerencias IA | > 50% |

### Fase 3

| Métrica | Target |
|---------|--------|
| Número de Tenants activos | 20+ |
| Países con presencia | 3+ |
| ARR (Annual Recurring Revenue) | Definir con equipo comercial |
