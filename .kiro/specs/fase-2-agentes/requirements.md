# Requirements — Fase 2: Sistema Multiagente

## Contexto

La Fase 1 implementó el core del SaaS (auth, clientes, vehículos, órdenes de trabajo, inventario, commerce, notificaciones) y el RouterAgent de clientes en NestJS. La Fase 2 agrega un microservicio Python con LangGraph que implementa el AgentAdmin y extiende las capacidades del sistema sin modificar lo construido.

## Principios de esta fase

1. **No romper Fase 1.** El microservicio Python es adición pura. NestJS no se refactoriza.
2. **Humano en el loop para decisiones críticas.** El agente sugiere, el humano aprueba.
3. **WhatsApp es canal de notificación, no de gestión.** La gestión vive en la plataforma web.
4. **Python como elección técnica justificada.** LangGraph Python es production-ready; el ecosistema de análisis de datos (pandas) es superior al JS para reportes.

---

## REQ-F2-01 — Routing de WhatsApp por tipo de usuario

**Historia**: Como sistema, quiero identificar si un mensaje de WhatsApp viene del admin o de un cliente, para enrutarlo al agente correcto.

**Criterios de aceptación**:

- El webhook de WhatsApp en NestJS verifica si el número remitente coincide con el `whatsappPhone` de un User con rol OWNER en la BD
- Si coincide → reenvía el mensaje al microservicio Python (`POST /agents/admin`)
- Si no coincide → procesa con el RouterAgent existente de NestJS (sin cambios)
- Si el microservicio Python no está disponible → el mensaje llega al recepcionista humano (no falla silenciosamente)
- El cambio en NestJS es máximo ~15 líneas en el webhook handler existente

---

## REQ-F2-02 — AgentAdmin: preguntas libres por WhatsApp

**Historia**: Como dueño del taller, quiero poder preguntarle al agente por WhatsApp sobre el estado del negocio en cualquier momento, para tomar decisiones sin abrir el computador.

**Criterios de aceptación**:

- El admin puede escribir preguntas en lenguaje natural: "¿cuánto vendí esta semana?", "¿qué repuestos se están acabando?", "¿cuál técnico cerró más órdenes este mes?"
- El agente responde en ≤ 10 segundos
- El agente responde en el mismo idioma del mensaje (español colombiano)
- Si la pregunta requiere más de 5 tool calls → el agente responde lo que pudo y avisa que no pudo completar el análisis
- Si el LLM falla → mensaje de fallback + log en Sentry
- El agente nunca ejecuta acciones destructivas (no puede borrar datos, solo leer y crear borradores)

---

## REQ-F2-03 — Memoria del AgentAdmin

**Historia**: Como admin, quiero que el agente recuerde el contexto de nuestra conversación aunque me ausente por un rato, para no tener que repetir el contexto cada vez.

**Criterios de aceptación**:

- La sesión del admin se mantiene activa por 2 horas desde el último mensaje
- Después de 2 horas de inactividad, la sesión expira y la siguiente conversación comienza limpia
- El agente puede hacer referencia a mensajes anteriores dentro de la misma sesión: "el reporte que mencioné antes..."
- La memoria se almacena en Redis (mismo Redis de la Fase 1)
- La memoria no persiste entre sesiones (no hay memoria long-term en Fase 2)

---

## REQ-F2-04 — Reportes automáticos semanales

**Historia**: Como dueño del taller, quiero recibir un resumen semanal del negocio cada lunes, para empezar la semana con contexto claro.

**Criterios de aceptación**:

- Cada lunes a las 8:00 AM (hora Colombia, UTC-5) se genera automáticamente el reporte semanal
- El reporte cubre la semana anterior (lunes a domingo)
- Contenido del reporte: órdenes completadas, ingresos cobrados, técnico más productivo, repuestos más usados, stock crítico, órdenes canceladas
- El reporte se genera como PDF y se sube a Cloudflare R2
- El admin recibe WhatsApp: "📊 Tu reporte semanal está listo → [link a plataforma]"
- El link lleva directo a la sección de reportes en la plataforma web
- Si el reporte falla al generarse → notificación de error al admin + registro en Sentry

---

## REQ-F2-05 — Reportes automáticos mensuales

**Historia**: Como dueño del taller, quiero recibir un reporte completo del mes el primer día de cada mes.

**Criterios de aceptación**:

- El día 1 de cada mes a las 8:00 AM (hora Colombia) se genera el reporte mensual
- Cubre el mes calendario anterior completo
- Contenido adicional al semanal: tendencia de ingresos vs mes anterior, margen por categoría de repuesto, clientes nuevos vs recurrentes, tiempo promedio de resolución de órdenes, top 10 repuestos por rotación y por margen
- Mismo flujo de entrega: PDF en R2 → notificación WhatsApp → disponible en plataforma
- El admin puede solicitar el reporte de cualquier mes pasado escribiendo por WhatsApp: "reporte de abril"

---

## REQ-F2-06 — Reportes bajo demanda

**Historia**: Como admin, quiero poder pedir un reporte en cualquier momento sin esperar al lunes.

**Criterios de aceptación**:

- El admin puede escribir por WhatsApp: "reporte de esta semana", "reporte de marzo", "¿cómo vamos este mes?"
- El agente genera el reporte y notifica que está disponible en la plataforma
- Para consultas simples (ej: "¿cuánto vendí hoy?") el agente responde directamente en WhatsApp sin PDF
- Para reportes completos (semana/mes) siempre genera PDF en plataforma

---

## REQ-F2-07 — Alertas de stock bajo

**Historia**: Como admin, quiero recibir alertas cuando un repuesto esté por agotarse, para hacer el pedido a tiempo.

**Criterios de aceptación**:

- Cuando el `stock_disponible` de un Part cae por debajo de `minStockAlert`, se envía alerta automática al admin por WhatsApp
- La alerta incluye: nombre del repuesto, SKU, stock actual, stock mínimo configurado, sugerencia de cantidad a pedir basada en rotación de los últimos 30 días
- La alerta se envía máximo una vez cada 24 horas por repuesto (no spam)
- La alerta también aparece en la plataforma web (bell icon, ya implementado en Fase 1)
- El admin puede responder "ver repuesto" y el agente le da más contexto

---

## REQ-F2-08 — Orden de compra como borrador

**Historia**: Como admin, quiero que el agente prepare una orden de compra sugerida basada en el análisis de stock, para aprobarla con un click.

**Criterios de aceptación**:

- El agente puede preparar un borrador de orden de compra con los repuestos bajo mínimo
- El borrador incluye: repuesto, cantidad sugerida (basada en rotación), proveedor si está registrado
- El borrador se crea en la plataforma web con estado DRAFT
- El admin recibe WhatsApp: "📦 Orden de compra borrador lista para revisar → [link]"
- El admin aprueba o rechaza desde la plataforma web (no por WhatsApp)
- El agente NO envía órdenes a proveedores — solo prepara el borrador

---

## REQ-F2-09 — Servicio a domicilio vía agente de clientes

**Historia**: Como cliente, quiero solicitar un servicio a domicilio por WhatsApp cuando mi moto se quede varada o necesite servicio en mi ubicación.

**Criterios de aceptación**:

- El agente de clientes (NestJS, Fase 1) captura: nombre del cliente, dirección exacta, descripción del problema, número de contacto
- Crea una solicitud de servicio a domicilio en el SaaS con estado PENDIENTE
- Notifica inmediatamente al taller: WhatsApp del taller + notificación en plataforma web
- El admin/recepcionista asigna mecánico desde la plataforma web
- El cliente recibe confirmación automática cuando el servicio es asignado: "Tu servicio fue confirmado. El mecánico llegará en aproximadamente X minutos."
- El mecánico NO recibe notificación directa — toda la coordinación pasa por el taller
- El agente informa al cliente el costo estimado solo si está en el catálogo de servicios
- Si el taller no está en horario de atención → mensaje informando horario + creación de solicitud para el día siguiente

---

## REQ-F2-10 — Plataforma web: sección de reportes

**Historia**: Como admin, quiero ver y descargar todos mis reportes desde la plataforma web.

**Criterios de aceptación**:

- Nueva página `/reports` en la plataforma web
- Lista todos los reportes generados (semanales, mensuales, bajo demanda) con fecha y tipo
- Permite descargar el PDF de cada reporte
- Muestra un preview inline del reporte más reciente
- Permite filtrar por tipo (semanal/mensual) y por rango de fechas
- Solo accesible para usuarios con rol OWNER o ADMIN

---

## REQ-F2-11 — Plataforma web: gestión de solicitudes de domicilio

**Historia**: Como recepcionista o admin, quiero ver y gestionar las solicitudes de servicio a domicilio desde la plataforma.

**Criterios de aceptación**:

- Nueva sección en la plataforma: `/home-services`
- Lista solicitudes con estado: PENDIENTE, ASIGNADO, EN_CAMINO, COMPLETADO, CANCELADO
- Permite asignar un mecánico (usuario con rol TECHNICIAN) a la solicitud
- Al asignar → notificación automática al cliente por WhatsApp
- Permite cambiar el estado manualmente
- Integrado con el sistema de órdenes de trabajo (una solicitud de domicilio puede convertirse en WorkOrder)

---

## REQ-F2-12 — Infraestructura del microservicio Python

**Historia**: Como desarrollador, quiero el microservicio Python integrado al monorepo con CI/CD funcional.

**Criterios de aceptación**:

- Ubicación: `apps/agents/` en el monorepo existente
- Stack: Python 3.12+, FastAPI, LangGraph, LangChain, Redis, APScheduler, httpx, pydantic
- `docker-compose.yml` agrega servicio `agents` en puerto 8000
- Variables de entorno compartidas desde `.env.local`
- GitHub Actions actualizado para incluir tests y deploy del microservicio Python
- El microservicio expone: `POST /agents/admin` (mensajes del admin) y `GET /health`
- Comunicación con NestJS vía HTTP interno en Docker network
- Logs estructurados JSON compatibles con el sistema de observabilidad existente

---

## REQ-F2-13 — Capa de integración en NestJS (Fase 2A, prerequisito técnico)

**Historia**: Como sistema, necesito que NestJS exponga endpoints REST que el microservicio Python pueda consumir de forma autenticada, ya que Python no accede a la BD directamente y el sistema de Fase 1 no tiene esta capa.

**Criterios de aceptación**:

- **Auth de servicio**: un `ServiceAuthGuard` acepta JWT firmados con el `JWT_SECRET` existente que lleven el claim `type: "service"`; no consulta la tabla `Role` ni `PermissionGuard`. Los tokens de usuario de Fase 1 siguen funcionando sin cambios.
- **Un solo `AgentsController`** bajo `/api/agents/*` agrupa todo lo que consume Python: `tenants`, `dashboard/summary`, `inventory/status`, `work-orders/pending`, `purchase-orders/draft`, `reports`, `reports/generate`, `notifications/stock-alert`, `notifications/whatsapp`. El `tenantId` viaja explícito en cada request.
- **Endpoint de WhatsApp proactivo** (`POST /api/agents/notifications/whatsapp`) que resuelve el teléfono del OWNER del tenant y envía — el `POST /api/messages/send` actual no sirve (exige `sessionId` + JWT de usuario).
- **Creación de notificaciones in-app**: el sistema actual solo expone lectura; se añade el POST que permite registrar alertas de stock (`notifications.type = "STOCK_ALERT"`).
- **Endpoint para listar tenants activos** (`GET /api/agents/tenants`), inexistente hoy (solo había `GET /api/tenants/me`).
- **Migraciones Prisma**: tablas `reports`, `home_service_requests`, `purchase_order_drafts`, backward-compatible con Fase 1.
- **Esta fase (2A) debe completarse antes** de implementar el microservicio Python (2B).
