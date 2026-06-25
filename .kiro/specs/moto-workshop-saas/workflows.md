# Workflows — MotoWorkshop SaaS

---

## Workflow 1: Recepción de Vehículo y Creación de Orden de Trabajo

**Actor principal**: Recepcionista  
**Precondición**: Cliente y vehículo pueden ser nuevos o ya registrados

```
1. Recepcionista busca el cliente
   ├── Encontrado → usar Customer existente
   └── No encontrado → Crear nuevo Customer (campos obligatorios: nombre, documento, teléfono, ciudad)

2. Busca el vehículo del cliente
   ├── Encontrado → verificar que no tenga WorkOrder activa
   │   ├── Tiene activa → mostrar alerta, no continuar
   │   └── No tiene activa → continuar
   └── No encontrado → Crear nuevo Vehicle (placa, marca, modelo, año, color, motor)

3. Crear VehicleReception
   - Campos obligatorios: vehicle_id, customer_id, received_at, received_by, odometer_reading, fuel_level
   - Campos opcionales: observations, visible_damage_notes
   - Adjuntar fotos de estado inicial (opcional pero recomendado)
   → Sistema guarda VehicleReception y fotos en R2

4. Crear WorkOrder desde VehicleReception
   - Campos obligatorios: technician_id, service_type, problem_description, promised_delivery_at
   → Sistema asigna: order_number (WO-{YYYY}-{NNNNNN}), status = PENDING, branch_id
   → Sistema registra en AuditLog (CREATE, work_orders)

5. [Opcional] Crear Quote desde la WorkOrder
   → Ver Workflow 3: Cotización

6. Sistema notifica al Technician asignado (notificación interna WebSocket)

Estado final: WorkOrder en PENDING, VehicleReception registrada
```

---

## Workflow 2: Ciclo de Vida de una Orden de Trabajo

**Actor principal**: Técnico + Recepcionista  
**Precondición**: WorkOrder en PENDING

```
PENDING → IN_PROGRESS
  Actor: Técnico o Recepcionista
  Acción: Iniciar trabajo
  Trigger: Manual
  Efectos: registra timestamp en work_order_status_history

IN_PROGRESS → WAITING_PARTS
  Actor: Técnico o Admin
  Acción: Marcar que faltan repuestos
  Efectos:
    - registra timestamp en work_order_status_history
    - Sistema envía WhatsApp automático al cliente (async BullMQ):
      "Hola {customer_name}, su moto {vehicle_plate} está esperando repuestos..."
    - Si promised_delivery_at está definido, incluye estimación en el mensaje

WAITING_PARTS → IN_PROGRESS
  Actor: Admin o Recepcionista (cuando llegan los repuestos)
  Efectos: registra timestamp en work_order_status_history

IN_PROGRESS → COMPLETED
  Actor: Técnico o Admin
  Acción: Marcar trabajo completado
  Datos opcionales: odómetro final
  Efectos:
    - registra final_odometer en work_orders
    - actualiza current_odometer en vehicles
    - registra timestamp en work_order_status_history
    - Sistema envía WhatsApp automático al cliente (async BullMQ):
      "Hola {customer_name}, su moto {vehicle_plate} está lista para recoger!"

COMPLETED → DELIVERED
  Actor: Recepcionista
  Acción: Confirmar entrega al cliente
  Efectos:
    - registra timestamp en work_order_status_history
    - Sistema confirma descuento de Parts reservados:
      → Para cada WorkOrderPart: decrementa stock_fisico, libera stock_reservado (StockEntry SALIDA + LIBERACION)
    - Sistema actualiza Customer:
      → incrementa visit_count (+1)
      → actualiza last_visit_at
      → si es primera visita, establece first_visit_at

CUALQUIER_ESTADO (excepto DELIVERED) → CANCELLED
  Actor: Admin u OWNER
  Efectos:
    - registra timestamp en work_order_status_history
    - Sistema libera stock_reservado de todos los WorkOrderParts (StockEntry LIBERACION)
    - NO decrementa stock_fisico
    - NO actualiza visit_count del Customer

Alerta de entrega próxima (job automático cada 30 min):
  SI WorkOrder.promised_delivery_at <= NOW() + 2h
  Y WorkOrder.status NOT IN ('COMPLETED', 'DELIVERED', 'CANCELLED')
  → Notificación interna a OWNER y ADMIN
  → WhatsApp automático al cliente (alerta de posible demora)
```

---

## Workflow 3: Cotización (Quote)

**Actor principal**: Recepcionista  
**Precondición**: WorkOrder en PENDING o IN_PROGRESS

```
1. Recepcionista crea Quote desde la WorkOrder
   → Sistema genera quote_number (Q-{YYYY}-{NNNNNN})
   → Quote inicia en estado DRAFT
   → Quote incluye: datos Tenant, Customer, Vehicle, líneas de servicio, Parts, IVA (19% default), total

2. [Opcional] Recepcionista modifica Quote
   → Sistema genera nueva versión (version++)
   → Versión anterior queda en quote_versions con su PDF en R2

3. Recepcionista genera PDF y envía al cliente
   → BullMQ: job GenerateQuotePdf → sube PDF a R2
   → Sistema retorna URL pre-firmada (24h)
   → Quote cambia a estado SENT
   → [Opcional] Recepcionista envía URL por WhatsApp desde la WorkOrder

4a. Cliente aprueba (recepcionista registra manualmente)
   → Quote: SENT → APPROVED
   → WorkOrder: automáticamente → IN_PROGRESS
   → Sistema registra en AuditLog

4b. Cliente rechaza
   → Quote: SENT → REJECTED
   → WorkOrder permanece en su estado actual

4c. No hay respuesta antes de valid_until
   → Job automático: Quote SENT → EXPIRED
   → No afecta estado de WorkOrder
```

---

## Workflow 4: Gestión de Inventario

**Actor principal**: Admin / Recepcionista

### Registro de Entrada de Stock
```
1. Admin selecciona Part (o crea nuevo Part si no existe con ese SKU)
2. Registra StockEntry tipo ENTRADA: quantity, branch_id, notes
3. Sistema incrementa stock_fisico en part_branch_stocks
4. Sistema registra StockEntry en historial
5. UI muestra nuevo stock_disponible = stock_fisico - stock_reservado
```

### Ajuste por Conteo Físico
```
1. Admin realiza conteo físico del Part en la Branch
2. Ingresa cantidad contada
3. Sistema calcula diferencia (contado - stock_fisico actual)
4. Sistema requiere justificación obligatoria (notas)
5. Sistema registra StockEntry tipo AJUSTE con la diferencia
6. Sistema actualiza stock_fisico
```

### Transferencia Entre Sucursales
```
1. Admin selecciona Part, Branch origen, Branch destino, quantity
2. Sistema verifica que stock_disponible en origen >= quantity
3. SI Branch destino no tiene registro del Part:
   → Sistema crea part_branch_stocks con stock_fisico = 0, stock_reservado = 0
4. En transacción atómica:
   → StockEntry SALIDA en Branch origen
   → StockEntry ENTRADA en Branch destino
   → Actualiza part_branch_stocks en ambas Branch
5. Sistema registra ambos movimientos con referencia cruzada
```

---

## Workflow 5: Comunicación WhatsApp

### Mensaje Entrante — Cliente Registrado
```
1. Webhook Meta → ProcessIncomingMessage
2. Sistema busca número en customers.phone Y customers.whatsapp_phone
3. Encontrado → asociar mensaje a WhatsAppSession del Customer
4. Registrar mensaje en tabla messages (INBOUND)
5. ¿Recepcionista respondió en últimos 5 min?
   → Sí: mostrar en bandeja, no activar AI
   → No Y dentro de horario de atención: activar RouterAgent (ver Workflow 6)
6. Mostrar mensaje en bandeja del sistema para el Recepcionista
7. Generar notificación interna a RECEPTIONIST si no hay respuesta en 5 min
```

### Mensaje Entrante — Número Desconocido
```
1. Número no encontrado en customers
2. Sistema crea WhatsAppSession anónima (is_anonymous = true)
3. Genera notificación interna a RECEPTIONIST
4. RouterAgent responde SOLO con getBusinessInformation
   → puede responder sobre: horarios, ubicación, servicios, información general
   → NO puede consultar órdenes, historial ni pagos
```

### Mensaje Saliente Manual
```
1. Recepcionista abre ficha del Customer o WorkOrder
2. Escribe mensaje manualmente
3. Sistema encola en BullMQ (whatsapp-outbound)
4. Worker envía via Meta WhatsApp Cloud API
5. Registra mensaje en messages (OUTBOUND, sent_by = user_id, is_ai = false)
6. Actualiza estado: SENT → DELIVERED → READ según webhooks de Meta
7. Si falla: reintenta 3 veces con 30s de intervalo → registra FAILED
```

---

## Workflow 6: Atención con IA (RouterAgent)

**Precondición**: Mensaje entrante, sin respuesta del recepcionista en 5 min, dentro de horario de atención

```
1. RouterAgent recibe contexto:
   - mensaje del cliente
   - historial de conversación (últimos N mensajes)
   - Customer profile (si está registrado)
   - Tools disponibles (según si es cliente registrado o anónimo)

2. LLM (DeepSeek, timeout 10s) clasifica intención:
   - consulta de orden → getWorkOrderStatus
   - consulta de inventario → checkInventory
   - historial de vehículo → getVehicleHistory
   - agendar cita → createAppointment
   - solicitar cotización → createQuote
   - información general → getBusinessInformation
   - solicitar hablar con humano → escalar

3. ToolExecutor:
   a. Valida schema de entrada (TypeScript strict)
   b. Si falla validación → error tipado al LLM, no ejecuta UseCase
   c. Si OK → invoca UseCase → obtiene resultado (timeout 5s)
   d. Registra invocación en log: timestamp, tool, params (sin datos sensibles), resultado, duración
   e. Verifica que no supere 5 invocaciones en el mensaje

4. LLM genera respuesta en español (o idioma detectado)

5. Si LLM falla o timeout:
   → Reintentar con Groq (timeout 10s)
   → Si Groq también falla:
     → Enviar mensaje de fallback predefinido al cliente
     → Generar notificación interna al RECEPTIONIST

6. Si 3 intentos consecutivos sin resolución:
   → Escalar al RECEPTIONIST (notificación interna)
   → Informar al cliente que será atendido por una persona

7. Enviar respuesta (async BullMQ: whatsapp-outbound)
8. Registrar mensaje en messages (OUTBOUND, is_ai = true)
```

---

## Workflow 7: Registro de Pago

**Actor principal**: Recepcionista o Admin  
**Precondición**: WorkOrder existe (cualquier estado excepto PENDING sin trabajo iniciado)

```
1. Recepcionista abre WorkOrder
2. Visualiza: total de la orden vs total pagado vs saldo pendiente
3. Registra nuevo Payment:
   - amount (obligatorio, > 0)
   - payment_method: CASH / TRANSFER / CARD / OTHER
   - reference (opcional): número de transacción
   - notes (opcional)
   - paid_at (default: NOW())
4. Sistema registra Payment
5. Sistema recalcula: total_pagado = SUM(payments.amount) para esta WorkOrder
6. Sistema muestra saldo: total_orden - total_pagado
7. Sistema genera notificación interna al ADMIN: "Pago registrado: ${amount} para orden {order_number}"
8. Sistema registra en AuditLog (CREATE, payments)
```

---

## Workflow 8: Dashboard — Carga de Métricas

**Actor principal**: OWNER o ADMIN

```
1. Usuario accede al Dashboard
2. Sistema carga período por defecto: mes en curso (primer día al día actual)
3. Para cada widget:

   WorkOrders activas por estado:
   → Query: COUNT(*) GROUP BY status WHERE branch_id = $branch AND deleted_at IS NULL

   Total cobrado del día / mes:
   → Query: SUM(payments.amount) WHERE paid_at >= $inicio AND branch = $branch (via work_orders)

   Promedio tiempo de ciclo:
   → Query: AVG(delivered_at - created_at) para WorkOrders DELIVERED en el período

   Alertas de stock bajo:
   → Query: part_branch_stocks WHERE stock_disponible < min_stock_alert AND branch_id = $branch

   WorkOrders próximas a vencer:
   → Query: WorkOrders WHERE promised_delivery_at <= NOW()+2h AND status NOT IN (COMPLETED,DELIVERED,CANCELLED)

   Ranking de Technicians:
   → Query: COUNT(work_orders) GROUP BY technician_id WHERE status = COMPLETED en período

   Tendencia de ingresos 30 días:
   → Query: SUM(payments.amount) GROUP BY DATE(paid_at) últimos 30 días

   Top 10 Parts por rotación:
   → Query: SUM(work_order_parts.quantity) GROUP BY part_id ORDER BY sum DESC LIMIT 10

4. Todos los widgets se actualizan cada 60 segundos (polling o WebSocket push)
5. Para OWNER con multi-Branch: selector de Branch o vista consolidada
```
