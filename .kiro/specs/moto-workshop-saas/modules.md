# Modules — MotoWorkshop SaaS

---

## Resumen de Módulos — Fase 1

| Módulo | Bounded Context | Estado Fase 1 |
|--------|----------------|---------------|
| Identity | Tenant, Branch, User, Role, Permission | ✅ Implementar |
| Customers | Customer, Vehicle, VehicleOwnership | ✅ Implementar |
| Workshop | VehicleReception, WorkOrder, WorkOrderLine, WorkOrderPart | ✅ Implementar |
| Inventory | Part, PartBranchStock, StockEntry, StockTransfer | ✅ Implementar |
| Commerce | Quote, Payment, InvoiceProvider (abstracción) | ✅ Implementar |
| Storage | Cloudflare R2 (shared service) | ✅ Implementar |
| Messaging | WhatsApp, WhatsAppSession, Message | ✅ Implementar |
| AI | RouterAgent, Tools, LLM adapters | ✅ Implementar |
| Notifications | WebSocket, notificaciones internas | ✅ Implementar |
| Dashboard | Métricas, reportes | ✅ Implementar |
| Audit | Log de auditoría inmutable | ✅ Implementar |
| Sales | MotorcycleUnit, SaleOrder | 🔲 Solo entidades base en dominio |

---

## Módulo 1: Identity

**Responsabilidad**: gestión de Tenants, Branches, Users, Roles y Permissions.

### Entidades
- `Tenant`, `Branch`, `User`, `Role`, `Permission`, `UserBranchAccess`

### Casos de Uso
- `CreateTenant` (manual, sin UI en Fase 1)
- `CreateBranch`
- `InviteUser` / `CreateUser`
- `AssignRole`
- `CreateCustomRole`
- `UpdatePermissions`
- `DeactivateUser`
- `DeleteRole` (requiere reasignación previa)
- `AuthenticateUser` (email + password → JWT + refresh token)
- `RefreshToken`
- `RevokeToken`

### Reglas de dominio
- OWNER y ADMIN pueden crear roles personalizados.
- Un Role con usuarios asignados no puede eliminarse sin reasignación previa.
- TECHNICIAN solo ve WorkOrders asignadas a él.
- RECEPTIONIST ve todas las WorkOrders de su Branch.
- ADMIN ve y opera toda su Branch.
- OWNER tiene acceso total al Tenant.

---

## Módulo 2: Customers

**Responsabilidad**: gestión de clientes y vehículos con historial completo.

### Entidades
- `Customer`, `Vehicle`, `VehicleOwnershipHistory`

### Casos de Uso — Customer
- `RegisterCustomer`
- `UpdateCustomer`
- `DeactivateCustomer` (soft delete — `deleted_at`)
- `SearchCustomers` (por nombre, documento, teléfono, placa)
- `GetCustomerProfile` (datos + vehículos + últimas 10 órdenes)
- `GetCustomerHistory` (paginación completa)
- `UpdateVisitStats` (triggered al completar WorkOrder → DELIVERED)

### Casos de Uso — Vehicle
- `RegisterVehicle`
- `UpdateVehicle`
- `TransferVehicleOwnership`
- `GetVehicleHistory` (WorkOrders + Parts + Evidencias)
- `UpdateVehicleOdometer`
- `DeactivateVehicle` (soft delete)

### Reglas de dominio
- `documentNumber` es único por Tenant (no por plataforma).
- `plate` es única por Tenant.
- `whatsappPhone` puede diferir de `phone` — ambos se usan para matching de mensajes entrantes.
- Un Vehicle con WorkOrder activa (IN_PROGRESS o WAITING_PARTS) no puede recibir nueva WorkOrder.
- `visitCount` se incrementa solo cuando WorkOrder → DELIVERED. Las CANCELLED no cuentan.

---

## Módulo 3: Workshop

**Responsabilidad**: recepción formal de vehículos y ciclo de vida de órdenes de trabajo.

### Entidades
- `VehicleReception`, `WorkOrder`, `WorkOrderLine`, `WorkOrderPart`, `WorkOrderStatusHistory`, `PhotoEvidence`

### Casos de Uso — VehicleReception
- `CreateVehicleReception`
- `AddReceptionPhoto`
- `GetVehicleReception`

### Casos de Uso — WorkOrder
- `CreateWorkOrder` (requiere VehicleReception)
- `TransitionWorkOrderStatus`
- `AssignTechnician`
- `AddServiceLine`
- `UpdateServiceLine`
- `RemoveServiceLine`
- `AddPartToWorkOrder` (verifica stock_disponible, reserva)
- `RemovePartFromWorkOrder` (libera reserva)
- `CompleteWorkOrder` (registra odómetro final)
- `DeliverWorkOrder` (confirma descuento de stock)
- `CancelWorkOrder` (libera reservas de stock)
- `GetWorkOrderDetail`
- `ListWorkOrders` (filtros por estado, Branch, Technician, fecha)

### Casos de Uso — PhotoEvidence
- `UploadPhotoEvidence`
- `DeletePhotoEvidence` (solo si WorkOrder ≠ DELIVERED)
- `GetPhotoEvidenceUrls` (genera URLs pre-firmadas 24h)

### Reglas de dominio
- Toda WorkOrder nace de una VehicleReception. No hay WorkOrders sin recepción.
- Máquina de estados estricta: PENDING → IN_PROGRESS → WAITING_PARTS → IN_PROGRESS → COMPLETED → DELIVERED. CANCELLED desde cualquier estado excepto DELIVERED.
- Al agregar Part: verificar `stock_disponible >= cantidad` → si OK, incrementar `stock_reservado`.
- Al pasar a DELIVERED: decrementar `stock_fisico`, liberar `stock_reservado`.
- Al CANCELLED: solo liberar `stock_reservado`.
- `unitPriceAtSale` en WorkOrderPart es inmutable tras creación.
- Máximo 20 PhotoEvidences por WorkOrder.
- JPEG/WebP > 2MB se comprimen a calidad 80%. PNG > 2MB se convierte a WebP y se comprime.
- Al cambiar a COMPLETED o WAITING_PARTS: trigger automático → envío de WhatsApp al cliente.
- `promised_delivery_at` es obligatorio. Alerta ≤ 2 horas → notificación interna (OWNER, ADMIN) + WhatsApp al cliente.


---

## Módulo 4: Inventory

**Responsabilidad**: gestión de partes/repuestos con tres niveles de stock por sucursal.

### Entidades
- `Part`, `PartBranchStock`, `StockEntry`, `StockTransfer`

### Casos de Uso
- `RegisterPart`
- `UpdatePart`
- `DeactivatePart`
- `GetPartDetail`
- `ListParts`
- `RegisterStockEntry` (ENTRADA manual)
- `RegisterStockExit` (SALIDA manual)
- `AdjustInventory` (AJUSTE con justificación obligatoria)
- `TransferStockBetweenBranches` (atómico; crea registro en destino si no existe)
- `GetInventoryValuationReport`
- `GetLowStockAlerts`
- `GetTopRotatingParts`
- `ReserveStock` (interno — llamado por AddPartToWorkOrder)
- `ReleaseStock` (interno — llamado al CANCEL o al remover Part)
- `ConfirmStockDiscount` (interno — llamado al DELIVER)

### Reglas de dominio
- `sku` es único por Tenant.
- `stock_disponible` = `stock_fisico` - `stock_reservado`. Solo `stock_disponible` se muestra al usuario.
- `stock_fisico` nunca puede ser negativo.
- `stock_reservado` nunca puede exceder `stock_fisico`.
- Alerta de stock bajo: cuando `stock_disponible` cae por debajo de `minStockAlert` → notificar OWNER y ADMIN.
- Transferencia entre Branch es atómica: si la Branch destino no tiene el Part registrado, se crea el registro con `stock_fisico = 0` antes de ejecutar la transferencia.

---

## Módulo 5: Commerce

**Responsabilidad**: cotizaciones en PDF y pagos manuales.

### Entidades
- `Quote`, `QuoteVersion`, `Payment`, `InvoiceProvider` (abstracción — no implementada)

### Casos de Uso — Quote
- `CreateQuote` (desde WorkOrder en PENDING o IN_PROGRESS)
- `UpdateQuote` (genera nueva versión)
- `SendQuote` (cambia estado a SENT, envía URL por WhatsApp)
- `ApproveQuote` (estado → APPROVED, WorkOrder → IN_PROGRESS automáticamente)
- `RejectQuote` (estado → REJECTED)
- `ExpireQuote` (job automático cuando pasa `validUntil`)
- `GetQuoteDetail`
- `GenerateQuotePdf` (async via BullMQ)
- `GetQuotePdfUrl` (retorna URL pre-firmada 24h)

### Casos de Uso — Payment
- `RegisterPayment`
- `GetPaymentsByWorkOrder`
- `GetPaymentSummary` (total pagado vs total de WorkOrder)
- `ListPayments` (filtros por Branch, fecha, método)

### Reglas de dominio
- Quote solo se puede crear desde WorkOrders en PENDING o IN_PROGRESS.
- Quote en DELIVERED o CANCELLED → error descriptivo.
- Ciclo de estados: DRAFT → SENT → APPROVED / REJECTED / EXPIRED.
- Cada modificación de Quote genera una nueva versión; las anteriores se conservan en R2.
- Al aprobar Quote: WorkOrder transiciona automáticamente a IN_PROGRESS.
- `Payment.amount` debe ser mayor que cero.
- Múltiples Payments permitidos por WorkOrder (pagos parciales).
- Las métricas financieras del Dashboard usan Payments, no solo WorkOrders cerradas.
- `InvoiceProvider` es una interfaz vacía en infrastructure; no se implementa en Fase 1.

---

## Módulo 6: Messaging (WhatsApp)

**Responsabilidad**: integración con Meta WhatsApp Cloud API, sesiones de conversación y mensajería manual.

### Entidades
- `WhatsAppSession`, `Message`

### Casos de Uso
- `SendAutomaticNotification` (triggered por cambios de estado en WorkOrder)
- `SendManualMessage` (desde ficha de Customer o WorkOrder)
- `SendQuoteUrl` (desde WorkOrder → WhatsApp)
- `ProcessIncomingMessage` (webhook Meta → clasificar, asociar a Customer o crear sesión anónima)
- `GetConversationHistory`
- `MarkMessageAsRead`
- `RetryFailedMessage` (BullMQ — hasta 3 intentos con 30s de intervalo)

### Reglas de dominio
- Match de número entrante: se busca en `Customer.phone` Y en `Customer.whatsappPhone`. Cualquier coincidencia asocia el mensaje al Customer.
- Si el número no es de ningún Customer: crear `WhatsAppSession` anónima, notificar a RECEPTIONIST.
- Los mensajes se encolan en BullMQ `whatsapp-outbound`. Si Meta API no está disponible, los mensajes se procesan cuando el servicio se restaure.
- Variables dinámicas en plantillas: `{customer_name}`, `{vehicle_plate}`, `{work_order_number}`, `{estimated_delivery}` → mapea a `WorkOrder.promised_delivery_at`.
- Cada mensaje tiene estado de entrega: SENT, DELIVERED, READ, FAILED.
- Notificaciones automáticas obligatorias:
  - WorkOrder → COMPLETED: "Su moto está lista para recoger"
  - WorkOrder → WAITING_PARTS: "Su moto está esperando repuestos"
  - WorkOrder con `promised_delivery_at` ≤ 2 horas sin estar en COMPLETED/DELIVERED: alerta de demora

---

## Módulo 7: AI

**Responsabilidad**: agente Router que clasifica intenciones y responde consultas de clientes por WhatsApp usando Tools tipadas.

### Componentes
- `RouterAgent`: agente único en Fase 1
- `LLMProvider`: abstracción con implementaciones DeepSeek y Groq
- `ToolRegistry`: registro de Tools disponibles
- `ToolExecutor`: valida schema, invoca UseCase, registra resultado

### Tools disponibles en Fase 1

| Tool | Signature | UseCase invocado |
|------|-----------|-----------------|
| `getWorkOrderStatus` | `(workOrderId: string)` | GetWorkOrderDetail |
| `checkInventory` | `(partSku: string, branchId: string)` | GetPartDetail |
| `getVehicleHistory` | `(vehicleId: string)` | GetVehicleHistory |
| `createAppointment` | `(customerId: string, requestedDate: string, serviceType: string)` | CreateVehicleReception (pre-agendamiento) |
| `createQuote` | `(workOrderId: string)` | CreateQuote |
| `getBusinessInformation` | `(infoType: 'hours' \| 'location' \| 'services' \| 'general')` | GetTenantPublicInfo |

### Reglas de dominio
- Máximo 5 invocaciones de Tools por mensaje.
- Si se supera el límite → escalar a humano.
- Timeout por Tool: 5 segundos.
- Timeout por LLM call: 10 segundos (DeepSeek) → fallback a Groq → fallback a mensaje predefinido.
- Números no registrados: solo pueden usar `getBusinessInformation`.
- El RouterAgent no puede hacer llamadas directas a la base de datos bajo ninguna circunstancia.
- Cada invocación se registra en log: timestamp, tool, parámetros (sin datos sensibles), resultado, duración.

### Flujo de procesamiento

```
1. Webhook WhatsApp → ProcessIncomingMessage
2. ¿Recepcionista respondió en últimos 5 min?
   → Sí: no activar AIAgent
   → No: continuar
3. ¿Dentro del horario de atención configurado?
   → No: enviar mensaje de fuera de horario
   → Sí: continuar
4. ¿Número registrado como Customer?
   → Sí: RouterAgent con acceso a todas las Tools
   → No: RouterAgent con acceso solo a getBusinessInformation
5. RouterAgent → LLM (DeepSeek con timeout 10s)
   → Timeout/Error: LLM (Groq con timeout 10s)
   → Timeout/Error: mensaje de fallback + notificar RECEPTIONIST
6. LLM selecciona Tool → ToolExecutor valida schema
7. ToolExecutor invoca UseCase → obtiene resultado
8. Repetir hasta 5 veces o hasta respuesta final
9. RouterAgent genera respuesta en idioma del mensaje
10. Enviar respuesta por WhatsApp (async via BullMQ)
```

---

## Módulo 8: Notifications

**Responsabilidad**: entrega de notificaciones internas en tiempo real por WebSocket/SSE.

### Eventos y destinatarios

| Evento | Destinatario |
|--------|-------------|
| WorkOrder próxima a vencer (≤ 2h) | OWNER, ADMIN |
| WorkOrder asignada a Technician | TECHNICIAN asignado |
| Stock de Part bajo el mínimo | OWNER, ADMIN |
| Payment registrado | ADMIN |
| Mensaje WhatsApp sin responder > 5 min | RECEPTIONIST |

### Casos de Uso
- `DeliverNotification`
- `MarkNotificationAsRead`
- `GetUnreadNotificationCount`
- `GetNotificationHistory` (últimas 100 por usuario)

### Reglas de dominio
- Entrega en tiempo real por WebSocket.
- Si la conexión WebSocket se pierde: al reconectar, se recuperan las notificaciones pendientes sin duplicar.
- Se conservan las últimas 100 notificaciones por usuario.

---

## Módulo 9: Dashboard

**Responsabilidad**: métricas operativas y financieras en tiempo real.

### Widgets y métricas

| Widget | Datos usados | Período default |
|--------|-------------|-----------------|
| WorkOrders activas por estado | WorkOrder.status | Tiempo real |
| Total cobrado del día | Payment.amount (hoy) | Día actual |
| Total cobrado del mes | Payment.amount (mes) | Mes en curso |
| Promedio tiempo de ciclo | WorkOrder: createdAt → deliveredAt | Mes en curso |
| Alertas de stock bajo | PartBranchStock.stockDisponible < minStockAlert | Tiempo real |
| WorkOrders retrasadas / próximas a vencer | WorkOrder.promisedDeliveryAt | Tiempo real |
| Ranking de Technicians | WorkOrders COMPLETED por técnico | Mes en curso |
| Tendencia de ingresos (30 días) | Payment.amount por día | Últimos 30 días |
| Top 10 Parts por rotación | WorkOrderPart.quantity | Mes en curso |
| Alerta WAITING_PARTS > 5 | WorkOrder.status = WAITING_PARTS count | Tiempo real |

### Reglas de dominio
- Período por defecto al cargar: mes en curso.
- Métricas financieras usan `Payment.amount` (cobrado), no `WorkOrder.total` (emitido).
- Actualización máxima: 60 segundos para indicadores en tiempo real.
- Filtros disponibles: rango de fechas personalizable + Branch (para usuarios con acceso multi-sucursal).
- Accesible desde móviles con resolución mínima de 375px.

---

## Módulo 10: Audit

**Responsabilidad**: log de auditoría inmutable para todas las operaciones de escritura.

### Casos de Uso
- `LogAuditEvent` (interno — llamado automáticamente por cada UseCase de escritura)
- `QueryAuditLog` (solo OWNER — filtros por entidad, usuario, acción, rango de fechas)

### Reglas de dominio
- Retención mínima: 2 años.
- Los registros no pueden ser eliminados por ningún usuario del Tenant.
- Cada registro incluye: entity_type, entity_id, action, actor_user_id, tenant_id, branch_id, timestamp, datos_anteriores (JSON), datos_nuevos (JSON).
- Los accesos fallidos de autenticación también se registran.

---

## Módulo 11: Sales (Stub — Fase 2+)

**Responsabilidad**: venta de motocicletas nuevas y usadas. No implementado en Fase 1.

### Entidades definidas en dominio (sin implementar)
- `MotorcycleUnit`: inventario de motocicletas nuevas/usadas
- `SaleOrder`: orden de venta de una MotorcycleUnit

### Notas
- Las entidades están definidas en el dominio para garantizar compatibilidad con el modelo de datos existente.
- El sistema de permisos soporta la adición de nuevos recursos `motorcycles` y `sales` sin modificar roles existentes.
- El módulo de Customers es compatible con los flujos de venta (prospecto, comprador) sin modificar entidades existentes.
