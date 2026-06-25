# Requirements Document

---

## Introduction

MotoWorkshop SaaS es una plataforma de gestión integral diseñada para talleres y concesionarios de motocicletas en Latinoamérica. El sistema digitaliza completamente la operación del taller, cubriendo inventario de repuestos, órdenes de trabajo, atención al cliente vía WhatsApp, cotizaciones, pagos, evidencias fotográficas y analítica operativa.

La arquitectura está diseñada desde el inicio para soportar múltiples sucursales (multi-tenant desde el día uno), venta futura de motocicletas nuevas/usadas y la incorporación progresiva de agentes de inteligencia artificial especializados.

El sistema sigue los principios de Clean Architecture, Domain-Driven Design y SOLID. Toda la lógica de negocio reside en casos de uso. Los agentes de IA interactúan con el dominio únicamente a través de herramientas tipadas; ningún agente accede directamente a la base de datos. El sistema continúa operando con plena funcionalidad si los proveedores de IA no están disponibles.

El primer cliente es un taller en Barranquilla, Colombia (Fase 1). El idioma de trabajo es español latinoamericano.

---

## Glossary

- **Platform**: El sistema SaaS MotoWorkshop en su totalidad.
- **Tenant**: Una organización (taller o concesionario) que contrata el servicio. Cada tenant tiene datos completamente aislados.
- **Branch**: Sucursal física de un Tenant. Un Tenant puede tener una o varias Branch.
- **Workshop**: Módulo de gestión del taller (órdenes, técnicos, bahías).
- **Customer**: Persona natural o jurídica que lleva vehículos al taller o realiza compras.
- **Vehicle**: Motocicleta registrada en el sistema, asociada a un Customer.
- **VehicleReception**: Registro formal del estado de un vehículo al momento de su ingreso al taller. Precede obligatoriamente a la creación de una WorkOrder.
- **WorkOrder**: Orden de trabajo creada a partir de una VehicleReception para ejecutar un servicio sobre un Vehicle.
- **WorkOrderStatus**: Estado del ciclo de vida de una WorkOrder (PENDING, IN_PROGRESS, WAITING_PARTS, COMPLETED, DELIVERED, CANCELLED).
- **ServiceType**: Tipo de servicio ejecutado (MAINTENANCE, REPAIR, INSPECTION, CUSTOMIZATION).
- **Technician**: Usuario del sistema con Role TECHNICIAN, asignado a ejecutar servicios en WorkOrders.
- **Part**: Repuesto o accesorio gestionado en el inventario.
- **StockEntry**: Movimiento de inventario (entrada, salida, ajuste, reserva, liberación) de un Part.
- **stock_fisico**: Cantidad total de un Part presente físicamente en la Branch.
- **stock_reservado**: Cantidad de un Part comprometida por WorkOrders activas.
- **stock_disponible**: stock_fisico - stock_reservado. Cantidad vendible mostrada al usuario.
- **Quote**: Cotización formal generada en PDF para un Customer, con ciclo de vida propio.
- **QuoteStatus**: Estado de una Quote (DRAFT, SENT, APPROVED, REJECTED, EXPIRED).
- **Payment**: Registro manual de un pago recibido por una WorkOrder.
- **PhotoEvidence**: Fotografía adjunta a una WorkOrder como evidencia de estado del Vehicle.
- **WhatsAppSession**: Sesión de conversación activa entre un Customer y el sistema vía Meta WhatsApp Cloud API.
- **AIAgent**: Componente de software que ejecuta lógica usando LLMs mediante herramientas tipadas.
- **Tool**: Función tipada expuesta al AIAgent para interactuar con el dominio (sin acceso directo a BD).
- **Role**: Conjunto de permisos asignado a un usuario dentro de un Tenant.
- **Permission**: Capacidad granular de realizar una acción sobre un recurso del sistema.
- **Dashboard**: Vista agregada de métricas operativas del taller.
- **LLM**: Modelo de Lenguaje Grande. Proveedor principal: DeepSeek. Proveedor secundario: Groq.
- **InvoiceProvider**: Abstracción para futura integración con proveedores de facturación electrónica (DIAN). No implementada en Fase 1.
- **MotorcycleUnit**: Entidad para inventario de motocicletas nuevas/usadas. Definida en dominio, no implementada en Fase 1.
- **SaleOrder**: Orden de venta de una MotorcycleUnit. Definida en dominio, no implementada en Fase 1.

---

## Requirements

---

### Requirement 1: Gestión Multi-Tenant y Multi-Sucursal

**User Story:** Como administrador de la plataforma, quiero que cada taller opere de forma completamente aislada con soporte para múltiples sucursales, para garantizar la privacidad de datos y escalar el negocio.

#### Acceptance Criteria

1. THE Platform SHALL aislar completamente los datos de cada Tenant mediante un campo `tenant_id` presente en cada entidad de dominio persistida.
2. WHEN un usuario autenticado realiza cualquier consulta, THE Platform SHALL retornar únicamente datos pertenecientes al Tenant del usuario.
3. THE Platform SHALL soportar la creación de múltiples Branch por Tenant sin límite predefinido en la arquitectura base.
4. WHEN un usuario tiene acceso a múltiples Branch, THE Platform SHALL permitirle seleccionar la Branch activa en su sesión.
5. WHILE un usuario opera en una Branch específica, THE Platform SHALL filtrar todas las vistas de inventario, órdenes de trabajo y reportes por esa Branch.
6. IF un usuario intenta acceder a datos de un Tenant diferente al suyo, THEN THE Platform SHALL retornar HTTP 403 sin revelar si el recurso existe.
7. THE Platform SHALL registrar un log de auditoría para cada operación de escritura incluyendo: tenant_id, branch_id, user_id, timestamp y acción realizada.
8. THE Platform SHALL ser multi-tenant desde el día uno aunque Fase 1 opere con un único cliente; el alta de nuevos tenants será manual sin panel SuperAdmin.


---

### Requirement 2: Autenticación y Autorización basada en Roles

**User Story:** Como administrador del taller, quiero gestionar roles y permisos granulares para mis empleados, para controlar qué puede ver y hacer cada persona dentro del sistema.

#### Acceptance Criteria

1. THE Platform SHALL autenticar usuarios mediante email y contraseña, retornando un JWT con tiempo de expiración configurable por Tenant.
2. WHEN un JWT expira, THE Platform SHALL permitir renovarlo mediante un refresh token sin requerir nueva autenticación.
3. IF un refresh token es inválido o ha expirado, THEN THE Platform SHALL requerir autenticación completa nuevamente.
4. THE Platform SHALL proveer los roles predefinidos por Tenant: OWNER, ADMIN, RECEPTIONIST, TECHNICIAN, VIEWER.
5. THE Platform SHALL permitir a usuarios con Role OWNER o ADMIN crear roles personalizados con combinaciones de permisos granulares.
6. WHEN un usuario intenta ejecutar una acción, THE Platform SHALL verificar que su Role incluya el Permission requerido para esa acción.
7. THE Platform SHALL soportar permisos granulares: CREATE, READ, UPDATE, DELETE sobre cada módulo (customers, vehicles, work_orders, inventory, quotes, payments, reports).
8. IF se elimina un Role con usuarios asignados, THEN THE Platform SHALL requerir reasignación explícita de Role antes de proceder.
9. THE Platform SHALL aplicar las siguientes restricciones de visibilidad por rol: TECHNICIAN puede ver únicamente WorkOrders asignadas a él; RECEPTIONIST puede ver todas las WorkOrders de su Branch; ADMIN puede ver y operar toda su Branch; OWNER tiene acceso total al Tenant.

---

### Requirement 3: Gestión de Clientes

**User Story:** Como recepcionista del taller, quiero registrar y consultar clientes con su historial completo, para brindar un servicio personalizado y ágil.

#### Acceptance Criteria

1. THE Platform SHALL registrar un Customer con campos obligatorios: nombre completo, tipo de documento (CC/NIT/CE/Pasaporte), número de documento, teléfono principal y ciudad.
2. THE Platform SHALL registrar campos opcionales: correo electrónico, dirección, fecha de nacimiento, observaciones y número de WhatsApp (puede diferir del teléfono principal).
3. WHEN se intenta registrar un Customer con número de documento ya existente en el mismo Tenant, THE Platform SHALL retornar error de conflicto indicando que el documento ya está registrado.
4. THE Platform SHALL permitir búsqueda de Customers por nombre, número de documento, teléfono o placa de Vehicle asociado.
5. WHEN se consulta un Customer, THE Platform SHALL retornar el listado de sus Vehicles y las últimas 10 WorkOrders en orden cronológico descendente; el historial completo estará disponible mediante paginación.
6. THE Platform SHALL registrar la fecha de primer ingreso, fecha de última visita y el número total de visitas; una visita se contabiliza únicamente cuando una WorkOrder asociada alcanza el estado DELIVERED.
7. IF un Customer tiene WorkOrders con estado IN_PROGRESS o WAITING_PARTS, THEN THE Platform SHALL indicarlo visualmente en su ficha.
8. THE Platform SHALL permitir marcar un Customer como inactivo (soft delete con campo `deleted_at`) sin eliminarlo, preservando su historial completo y todos los archivos asociados en Cloudflare R2.


---

### Requirement 4: Gestión de Vehículos

**User Story:** Como técnico o recepcionista, quiero gestionar el historial completo de cada motocicleta, para tener trazabilidad total de los servicios realizados.

#### Acceptance Criteria

1. THE Platform SHALL registrar un Vehicle con campos obligatorios: placa, marca, modelo, año, color, número de motor y Customer propietario.
2. THE Platform SHALL registrar campos opcionales: número de chasis, cilindraje, tipo de combustible, kilometraje actual y observaciones generales.
3. WHEN se registra un Vehicle, THE Platform SHALL validar que la placa no exista previamente en el mismo Tenant.
4. THE Platform SHALL permitir actualizar el kilometraje de un Vehicle al cerrar una WorkOrder, manteniendo historial de lecturas con timestamp.
5. WHEN se consulta un Vehicle, THE Platform SHALL retornar el historial completo de WorkOrders, Parts utilizados y PhotoEvidences asociadas.
6. THE Platform SHALL soportar la transferencia de un Vehicle a un nuevo Customer, registrando fecha y Customer anterior en el historial.
7. IF un Vehicle tiene una WorkOrder activa (IN_PROGRESS o WAITING_PARTS), THEN THE Platform SHALL impedir crear una nueva WorkOrder para ese Vehicle hasta que la activa sea completada o cancelada.
8. THE Platform SHALL aplicar soft delete a Vehicles con campo `deleted_at`; los archivos asociados en Cloudflare R2 NO se eliminan físicamente para cumplimiento legal y de auditoría.

---

### Requirement 5: Recepción de Vehículos

**User Story:** Como recepcionista, quiero registrar el estado inicial del vehículo al recibirlo en el taller, para documentar su condición de ingreso y proteger legalmente al taller frente a reclamaciones posteriores.

#### Acceptance Criteria

1. THE Platform SHALL registrar una VehicleReception con campos obligatorios: vehicle_id, received_at, received_by (user_id), odometer_reading y fuel_level.
2. THE Platform SHALL registrar campos opcionales en VehicleReception: observations y visible_damage_notes.
3. THE Platform SHALL permitir adjuntar fotografías opcionales a una VehicleReception como evidencia del estado inicial del vehículo.
4. WHEN se crea una WorkOrder, THE Platform SHALL requerir una VehicleReception como punto de origen; no se permite crear una WorkOrder sin una VehicleReception asociada.
5. THE Platform SHALL almacenar las fotografías de VehicleReception en Cloudflare R2 bajo la ruta `/{tenant_id}/{branch_id}/receptions/{reception_id}/photos/{filename}`.
6. WHEN se consulta una WorkOrder, THE Platform SHALL retornar los datos completos de su VehicleReception asociada incluyendo URLs pre-firmadas de las fotografías.

---

### Requirement 6: Órdenes de Trabajo

**User Story:** Como jefe de taller, quiero gestionar el ciclo de vida completo de las órdenes de trabajo, para coordinar al equipo técnico y entregar los vehículos en el tiempo prometido.

#### Acceptance Criteria

1. THE Workshop SHALL crear una WorkOrder a partir de una VehicleReception, asociando obligatoriamente: Vehicle, Customer, Technician principal, ServiceType, descripción del problema y fecha de ingreso.
2. THE Workshop SHALL asignar automáticamente un número correlativo único por Tenant con formato `WO-{YYYY}-{NNNNNN}`.
3. WHEN se crea una WorkOrder, THE Workshop SHALL establecer su WorkOrderStatus inicial en PENDING.
4. THE Workshop SHALL permitir transiciones de WorkOrderStatus únicamente en el orden: PENDING → IN_PROGRESS → WAITING_PARTS → IN_PROGRESS → COMPLETED → DELIVERED. La transición a CANCELLED es válida desde cualquier estado excepto DELIVERED.
5. IF se intenta una transición no permitida, THEN THE Workshop SHALL retornar un error descriptivo indicando la transición inválida.
6. THE Workshop SHALL registrar el timestamp de cada cambio de WorkOrderStatus con: usuario que realizó el cambio y nota opcional.
7. WHEN una WorkOrder cambia a estado COMPLETED, THE Workshop SHALL registrar el kilometraje final del Vehicle si fue proporcionado.
8. THE Workshop SHALL registrar `promised_delivery_at` como campo obligatorio y alertar cuando falten ≤ 2 horas para esa fecha si la WorkOrder no está en estado COMPLETED o DELIVERED.
9. THE Workshop SHALL permitir agregar líneas de servicio con: descripción, tiempo estimado en horas, precio unitario y Technician asignado (puede diferir del técnico principal de cabecera).
10. THE Workshop SHALL permitir agregar Parts consumidos con: Part referenciado, cantidad utilizada y precio de venta al momento de la adición; ese precio queda congelado y no cambia si el catálogo se actualiza posteriormente.
11. WHEN se agrega un Part a una WorkOrder, THE Workshop SHALL verificar que el `stock_disponible` en la Branch sea suficiente y reservar la cantidad indicada incrementando `stock_reservado`.
12. IF el `stock_disponible` de un Part es insuficiente, THEN THE Workshop SHALL notificar al usuario e impedir la adición hasta que el stock sea repuesto.
13. WHEN una WorkOrder cambia a estado DELIVERED, THE Workshop SHALL confirmar el descuento definitivo de los Parts reservados del inventario, decrementando `stock_fisico` y liberando `stock_reservado`.
14. THE Workshop SHALL calcular y mostrar en tiempo real el total de la WorkOrder: suma de líneas de servicio + suma de Parts a precio de venta congelado.
15. THE Workshop SHALL aplicar soft delete a WorkOrders con campo `deleted_at`; los archivos asociados en Cloudflare R2 NO se eliminan físicamente.


---

### Requirement 7: Gestión de Inventario

**User Story:** Como administrador del taller, quiero controlar el inventario de repuestos y accesorios por sucursal usando los tres niveles de stock, para evitar quiebres y optimizar compras.

#### Acceptance Criteria

1. THE Platform SHALL registrar un Part con campos obligatorios: código SKU único por Tenant, nombre, categoría, unidad de medida, precio de costo y precio de venta.
2. THE Platform SHALL registrar campos opcionales: descripción, marca, referencia del proveedor, imagen, stock mínimo de alerta y ubicación en bodega.
3. THE Platform SHALL mantener para cada Part por Branch tres contadores: `stock_fisico`, `stock_reservado` y `stock_disponible` = `stock_fisico` − `stock_reservado`.
4. WHEN se registra un StockEntry de tipo ENTRADA, THE Platform SHALL incrementar `stock_fisico` del Part en la Branch indicada.
5. WHEN se registra un StockEntry de tipo SALIDA manual, THE Platform SHALL decrementar `stock_fisico` del Part en la Branch indicada.
6. IF una operación resultaría en `stock_fisico` negativo o en `stock_disponible` negativo, THEN THE Platform SHALL retornar error impidiendo la operación.
7. THE Platform SHALL mantener historial completo de StockEntries por Part y Branch con: timestamp, tipo (ENTRADA, SALIDA, AJUSTE, RESERVA, LIBERACION), cantidad, usuario responsable y referencia (WorkOrder o ajuste manual).
8. WHEN el `stock_disponible` de un Part en una Branch cae por debajo del stock mínimo configurado, THE Platform SHALL generar una alerta visible en el Dashboard para usuarios con roles OWNER o ADMIN.
9. THE Platform SHALL permitir transferencias de stock entre Branch del mismo Tenant de forma atómica; si la Branch destino no tiene registrado el Part, el sistema creará automáticamente el registro antes de ejecutar la transferencia.
10. THE Platform SHALL generar reporte de valorización de inventario por Branch mostrando: Part, stock_fisico, stock_reservado, stock_disponible, precio de costo, precio de venta y valor total a costo.
11. THE Platform SHALL permitir ajuste de inventario por conteo físico, registrando la diferencia como StockEntry de tipo AJUSTE con justificación obligatoria.

---

### Requirement 8: Pagos

**User Story:** Como recepcionista o administrador, quiero registrar manualmente los pagos recibidos por cada orden de trabajo, para llevar un control financiero preciso sin depender de integraciones bancarias.

#### Acceptance Criteria

1. THE Platform SHALL permitir registrar uno o más Payments asociados a una WorkOrder con campos obligatorios: amount, payment_method (CASH, TRANSFER, CARD, OTHER), paid_at y created_by.
2. THE Platform SHALL registrar campos opcionales en Payment: reference (número de transacción o comprobante) y notes.
3. THE Platform SHALL calcular y mostrar el total pagado vs total de la WorkOrder, indicando si existe saldo pendiente.
4. THE Platform SHALL permitir registrar pagos parciales; una WorkOrder puede tener múltiples Payments que en conjunto cubran el total.
5. WHEN se registra un Payment, THE Platform SHALL notificar al usuario con Role ADMIN mediante notificación interna.
6. THE Platform SHALL incluir los Payments registrados como base de cálculo para las métricas financieras del Dashboard (ingresos reales cobrados, no solo órdenes cerradas).
7. THE Platform SHALL proveer una abstracción `InvoiceProvider` en la capa de infraestructura para futura integración con DIAN u otros proveedores de facturación electrónica; no se implementará en Fase 1.


---

### Requirement 9: Cotizaciones en PDF

**User Story:** Como recepcionista, quiero generar cotizaciones profesionales en PDF con ciclo de vida controlado, para acelerar el proceso de aprobación del trabajo.

#### Acceptance Criteria

1. THE Platform SHALL generar una Quote a partir de una WorkOrder en estado PENDING o IN_PROGRESS, incluyendo: datos del Tenant, datos del Customer, datos del Vehicle, líneas de servicio, Parts cotizados, subtotales, IVA configurable (19% por defecto para Colombia) y total.
2. THE Platform SHALL asignar a cada Quote una numeración única con formato `Q-{YYYY}-{NNNNNN}` y un ciclo de vida con los estados: DRAFT → SENT → APPROVED / REJECTED / EXPIRED.
3. THE Platform SHALL exportar la Quote como PDF con el logo del Tenant y fecha de validez configurable.
4. WHEN se genera o actualiza una Quote en PDF, THE Platform SHALL almacenar el archivo en Cloudflare R2 y retornar una URL pre-firmada con expiración de 24 horas.
5. THE Platform SHALL registrar el historial de versiones de una Quote cuando es modificada, preservando versiones anteriores en Cloudflare R2.
6. THE Platform SHALL permitir enviar la URL de la Quote directamente al Customer vía WhatsApp desde la interfaz de la WorkOrder.
7. WHEN un recepcionista registra la aprobación de una Quote (estado → APPROVED), THE Platform SHALL actualizar automáticamente el estado de la WorkOrder asociada a IN_PROGRESS.
8. THE Quote SHALL incluir términos y condiciones del servicio configurables por Tenant.
9. IF se intenta generar una Quote para una WorkOrder en estado DELIVERED o CANCELLED, THEN THE Platform SHALL retornar un error descriptivo.
10. IF una Quote supera su fecha de validez sin ser aprobada o rechazada, THEN THE Platform SHALL cambiar automáticamente su estado a EXPIRED.

---

### Requirement 10: Evidencias Fotográficas

**User Story:** Como técnico, quiero adjuntar fotos del vehículo antes y durante el servicio, para documentar el trabajo y proteger al taller de reclamos.

#### Acceptance Criteria

1. THE Workshop SHALL permitir adjuntar PhotoEvidences a una WorkOrder en cualquier estado excepto CANCELLED.
2. THE Workshop SHALL aceptar archivos en formatos JPEG, PNG y WebP con tamaño máximo de 10 MB por archivo.
3. WHEN se sube una PhotoEvidence, THE Workshop SHALL almacenarla en Cloudflare R2 bajo la ruta `/{tenant_id}/{branch_id}/work-orders/{work_order_id}/evidences/{filename}`.
4. THE Workshop SHALL comprimir automáticamente imágenes que superen 2 MB antes de almacenarlas; para JPEG y WebP mantendrá calidad mínima del 80%; las imágenes PNG se convertirán a WebP antes de comprimir.
5. THE Workshop SHALL registrar por cada PhotoEvidence: timestamp de subida, usuario que subió, etiqueta de fase (INGRESO, PROCESO, ENTREGA) y descripción opcional.
6. WHEN se consulta una WorkOrder, THE Workshop SHALL retornar las URLs pre-firmadas de sus PhotoEvidences con expiración de 24 horas.
7. THE Workshop SHALL permitir subir un máximo de 20 PhotoEvidences por WorkOrder.
8. IF se intenta subir una PhotoEvidence con formato no permitido, THEN THE Workshop SHALL retornar un error indicando los formatos aceptados.
9. THE Workshop SHALL permitir eliminar una PhotoEvidence únicamente si la WorkOrder no está en estado DELIVERED; los archivos en Cloudflare R2 NO se eliminan físicamente (soft delete).


---

### Requirement 11: Dashboard y Métricas Operativas

**User Story:** Como dueño del taller, quiero ver métricas operativas en tiempo real basadas en datos de pagos reales, para tomar decisiones de negocio fundamentadas.

#### Acceptance Criteria

1. THE Dashboard SHALL mostrar con actualización máxima de 60 segundos los siguientes indicadores por Branch: WorkOrders activas por estado, total cobrado del día, total cobrado del mes y promedio de tiempo de ciclo por WorkOrder.
2. THE Dashboard SHALL cargar por defecto con el período del mes en curso para todos los widgets; el usuario puede cambiar el rango de fechas a uno personalizable.
3. THE Dashboard SHALL calcular métricas financieras (ingresos) usando Payments registrados, no únicamente WorkOrders cerradas.
4. THE Dashboard SHALL mostrar alertas de stock bajo para Parts con `stock_disponible` por debajo del mínimo configurado.
5. THE Dashboard SHALL mostrar un listado de WorkOrders con `promised_delivery_at` vencida o próxima a vencer (≤ 2 horas).
6. THE Dashboard SHALL mostrar el ranking de los 5 Technicians con mayor número de WorkOrders completadas en el período seleccionado.
7. THE Dashboard SHALL permitir filtrar todas las métricas por rango de fechas y por Branch (para usuarios con acceso multi-sucursal).
8. THE Dashboard SHALL mostrar un gráfico de tendencia de ingresos cobrados (Payments) de los últimos 30 días con granularidad diaria.
9. THE Dashboard SHALL mostrar los 10 Parts con mayor rotación (salida por WorkOrders) en el período seleccionado.
10. WHEN el número de WorkOrders en estado WAITING_PARTS supera 5 simultáneas, THE Dashboard SHALL mostrar una alerta destacada.
11. THE Dashboard SHALL ser accesible desde dispositivos móviles con resolución mínima de 375px de ancho, manteniendo legibilidad de todos los indicadores.

---

### Requirement 12: Integración WhatsApp (Meta Cloud API)

**User Story:** Como recepcionista, quiero gestionar la comunicación con clientes vía WhatsApp desde el sistema, para centralizar la atención y reducir el uso de teléfonos personales.

#### Acceptance Criteria

1. THE Platform SHALL conectarse a Meta WhatsApp Cloud API usando el número de teléfono configurado por Tenant para enviar y recibir mensajes.
2. WHEN una WorkOrder cambia a estado COMPLETED, THE Platform SHALL enviar automáticamente un mensaje WhatsApp al Customer notificando que su motocicleta está lista para recoger.
3. WHEN una WorkOrder cambia a WAITING_PARTS, THE Platform SHALL enviar automáticamente un mensaje WhatsApp al Customer indicando la espera de repuestos y estimación de demora si `promised_delivery_at` está disponible.
4. WHEN una WorkOrder está próxima a incumplir `promised_delivery_at` (≤ 2 horas) y no está en COMPLETED o DELIVERED, THE Platform SHALL enviar un mensaje WhatsApp al Customer y generar una notificación interna a usuarios con Role OWNER y ADMIN.
5. THE Platform SHALL registrar cada mensaje enviado o recibido en la WhatsAppSession del Customer con: timestamp y estado de entrega (SENT, DELIVERED, READ, FAILED).
6. WHEN se recibe un mensaje de un número registrado como Customer (por teléfono principal O número de WhatsApp), THE Platform SHALL asociarlo a la WhatsAppSession del Customer y mostrarlo en la bandeja del sistema.
7. WHEN se recibe un mensaje de un número NO registrado como Customer, THE Platform SHALL crear una WhatsAppSession anónima y notificar al recepcionista para atención manual.
8. THE Platform SHALL permitir enviar mensajes manuales de texto a cualquier Customer desde su ficha o desde la WorkOrder.
9. THE Platform SHALL soportar variables dinámicas en plantillas de mensajes: `{customer_name}`, `{vehicle_plate}`, `{work_order_number}`, `{estimated_delivery}` donde `{estimated_delivery}` mapea directamente al campo `WorkOrder.promised_delivery_at`.
10. IF el envío de un mensaje WhatsApp falla, THEN THE Platform SHALL reintentar hasta 3 veces con intervalo de 30 segundos y registrar el fallo final en el log de la WhatsAppSession.
11. THE Platform SHALL continuar operando con plena funcionalidad si Meta WhatsApp Cloud API no está disponible, encolando los mensajes pendientes en BullMQ para envío posterior.


---

### Requirement 13: Agente de IA para Atención WhatsApp

**User Story:** Como dueño del taller, quiero que un agente de IA responda automáticamente las consultas de los clientes por WhatsApp, para reducir la carga del recepcionista en consultas repetitivas.

#### Acceptance Criteria

1. THE AIAgent SHALL responder automáticamente a mensajes WhatsApp entrantes cuando el recepcionista no ha respondido en los últimos 5 minutos durante el horario de atención configurable del Tenant.
2. THE AIAgent SHALL actuar en Fase 1 como un único agente Router que clasifica la intención del mensaje, selecciona la Tool apropiada y genera la respuesta.
3. THE AIAgent SHALL responder en el mismo idioma del mensaje recibido (español por defecto).
4. THE AIAgent SHALL usar DeepSeek como proveedor LLM primario con timeout de 10 segundos por solicitud.
5. IF DeepSeek no responde dentro del timeout, THEN THE AIAgent SHALL reintentar con Groq como proveedor secundario sin interrumpir la conversación.
6. IF tanto DeepSeek como Groq fallan, THEN THE AIAgent SHALL enviar un mensaje de fallback predefinido al Customer y notificar al recepcionista para atención manual.
7. THE Platform SHALL continuar operando con plena funcionalidad si todos los proveedores LLM no están disponibles, procesando todas las operaciones no dependientes de IA.
8. THE AIAgent SHALL escalar la conversación a un humano cuando el Customer solicite explícitamente hablar con una persona o cuando el AIAgent no pueda resolver la consulta en 3 intentos consecutivos.
9. WHEN el AIAgent recibe un mensaje de un número NO registrado como Customer, THE AIAgent SHALL responder únicamente con información pública: horarios, ubicación, servicios disponibles e información general del taller; no podrá consultar órdenes, historial ni pagos hasta verificar la identidad.
10. THE AIAgent SHALL detectar automáticamente el idioma del mensaje para responder en el mismo idioma; el Tenant puede configurar un idioma fijo que sobrescriba la detección automática.
11. THE AIAgent SHALL registrar en log cada Tool invocada, proveedor LLM utilizado, latencia de respuesta y resultado obtenido.
12. THE AIAgent NO SHALL acceder directamente a ninguna tabla de base de datos; toda interacción con datos ocurre a través de Tools que invocan casos de uso del dominio.

---

### Requirement 14: Herramientas del Agente de IA (AI Tools)

**User Story:** Como arquitecto del sistema, quiero definir las herramientas tipadas que el agente puede usar, para garantizar que la IA nunca acceda directamente a la base de datos y toda la lógica de negocio permanezca en los casos de uso.

#### Acceptance Criteria

1. THE Platform SHALL exponer en Fase 1 las siguientes Tools tipadas para el AIAgent: `getWorkOrderStatus(workOrderId)`, `checkInventory(partSku, branchId)`, `getVehicleHistory(vehicleId)`, `createAppointment(customerId, requestedDate, serviceType)`, `createQuote(workOrderId)`, `getBusinessInformation(infoType)`.
2. WHEN el AIAgent invoca una Tool, THE Platform SHALL validar el schema de entrada con tipos estrictos TypeScript antes de ejecutar el caso de uso correspondiente.
3. IF la validación del schema falla, THEN THE Platform SHALL retornar al AIAgent un error tipado con descripción del campo inválido sin ejecutar el caso de uso.
4. THE Platform SHALL registrar cada invocación de Tool con: timestamp, nombre, parámetros de entrada (sin datos sensibles), resultado y duración en milisegundos.
5. THE Platform SHALL limitar al AIAgent a un máximo de 5 invocaciones de Tools por mensaje para prevenir bucles infinitos.
6. IF el AIAgent supera el límite de invocaciones por mensaje, THEN THE Platform SHALL detener la ejecución y escalar al recepcionista.
7. THE Platform SHALL proveer a cada Tool un timeout máximo de 5 segundos; si se supera, la Tool retornará un error de timeout al AIAgent.
8. THE Platform SHALL estar preparada para incorporar agentes especializados en Fase 2 (CommercialAgent, WorkshopAgent, FinancialAgent, ManagementAgent) y un SupervisorAgent de orquestación en Fase 3, sin modificar el esquema de Tools existente.


---

### Requirement 15: Observabilidad y Manejo de Errores

**User Story:** Como arquitecto de software, quiero observabilidad completa del sistema, para detectar y resolver incidentes rápidamente en producción.

#### Acceptance Criteria

1. THE Platform SHALL integrar Sentry para captura automática de excepciones no manejadas en frontend (Next.js) y backend (NestJS).
2. WHEN ocurre un error en el backend, THE Platform SHALL registrarlo en Sentry con contexto de: tenant_id, branch_id, user_id, trace_id, endpoint, stack trace y datos de entrada (sin información sensible).
3. THE Platform SHALL generar un trace_id único por request HTTP y propagarlo en todos los logs y eventos de Sentry del mismo request.
4. THE Platform SHALL registrar en Sentry el tiempo de respuesta de cada endpoint; si supera 2000ms lo clasificará como Performance Issue.
5. THE Platform SHALL capturar en Sentry cada error de integración con servicios externos (Meta WhatsApp API, DeepSeek, Groq, Cloudflare R2) con contexto completo de la llamada fallida.
6. IF un error crítico (5xx) ocurre en más de 10 requests en 60 segundos, THEN THE Platform SHALL generar una alerta en Sentry con prioridad HIGH.
7. THE Platform SHALL proveer un endpoint `/api/health` que retorne el estado de conectividad de: PostgreSQL, Cloudflare R2, Redis, BullMQ y Meta WhatsApp API.
8. THE Platform SHALL mantener logs estructurados en JSON con campos: timestamp, level, trace_id, tenant_id, message y metadata adicional.

---

### Requirement 16: Gestión de Archivos en Cloudflare R2

**User Story:** Como arquitecto del sistema, quiero que todos los archivos se almacenen en Cloudflare R2 con una política de URLs pre-firmadas unificada, para garantizar durabilidad, acceso controlado y consistencia.

#### Acceptance Criteria

1. THE Platform SHALL almacenar en Cloudflare R2 todos los archivos binarios: PhotoEvidences, fotografías de VehicleReception, PDFs de Quotes y logos de Tenant.
2. THE Platform SHALL generar URLs pre-firmadas con expiración de 24 horas para todos los tipos de archivos sin excepciones.
3. WHEN se solicita una URL pre-firmada, THE Platform SHALL verificar que el usuario tenga permisos de lectura sobre el recurso al que pertenece el archivo.
4. THE Platform SHALL organizar archivos bajo la estructura: `/{tenant_id}/{branch_id}/{resource_type}/{resource_id}/{filename}`.
5. IF la subida de un archivo falla, THEN THE Platform SHALL reintentar hasta 3 veces y retornar error al usuario si todos fallan, sin dejar registros huérfanos en la base de datos.
6. THE Platform SHALL NO eliminar físicamente archivos de Cloudflare R2 cuando los recursos padre sean eliminados (soft delete); los archivos se conservan para auditoría y cumplimiento legal.
7. WHEN un Tenant actualiza su logo, THE Platform SHALL reemplazar el archivo anterior en Cloudflare R2 (este es el único caso de reemplazo físico permitido) y reflejar el cambio en nuevas Quotes generadas.

---

### Requirement 17: Arquitectura Clean — Casos de Uso y Dominio

**User Story:** Como arquitecto de software, quiero que toda la lógica de negocio resida en casos de uso del dominio, para que el sistema sea mantenible, testeable y agnóstico a la infraestructura.

#### Acceptance Criteria

1. THE Platform SHALL implementar toda la lógica de negocio como casos de uso independientes con una sola responsabilidad, sin dependencia directa de frameworks de infraestructura.
2. THE Platform SHALL definir interfaces de repositorio en la capa de dominio; las implementaciones concretas (Prisma) residen en la capa de infraestructura.
3. WHEN se ejecuta un caso de uso, THE Platform SHALL resolver sus dependencias mediante inyección de dependencias sin que el caso de uso conozca las implementaciones concretas.
4. THE Platform SHALL validar invariantes de dominio dentro de las entidades y objetos de valor antes de persistir cualquier cambio.
5. IF una validación de invariante de dominio falla, THEN THE Platform SHALL lanzar una excepción de dominio tipada con código de error semántico y mensaje descriptivo.
6. THE Platform SHALL separar explícitamente las capas: domain, application (use cases), infrastructure (Prisma, APIs externas, BullMQ, Redis), presentation (controllers).
7. THE Platform SHALL garantizar que ningún módulo de la capa de dominio importe desde la capa de infraestructura.


---

### Requirement 18: Rendimiento y Escalabilidad

**User Story:** Como arquitecto del sistema, quiero que la plataforma mantenga tiempos de respuesta aceptables bajo carga normal, para garantizar una experiencia fluida.

#### Acceptance Criteria

1. THE Platform SHALL responder el 95% de las requests de lectura (GET) en menos de 500ms bajo carga de hasta 50 usuarios concurrentes por Tenant.
2. THE Platform SHALL responder el 95% de las requests de escritura (POST/PUT/PATCH) en menos de 1000ms bajo la misma carga.
3. THE Platform SHALL implementar paginación en todos los listados con parámetros `page` y `pageSize` (máximo 100 registros por página).
4. THE Platform SHALL implementar índices en PostgreSQL sobre: tenant_id, branch_id, customer_id, vehicle_id, work_order_id, created_at, deleted_at.
5. THE Platform SHALL cachear en Redis (TTL: 5 minutos) los datos de configuración del Tenant que no cambian frecuentemente: roles, permisos y configuración de WhatsApp.
6. WHEN una consulta de base de datos supera 1000ms, THE Platform SHALL registrarla como slow query en el log de observabilidad con texto completo de la consulta y parámetros.
7. THE Platform SHALL usar BullMQ para procesar de forma asíncrona: envío de mensajes WhatsApp, generación de PDFs, compresión de imágenes y eliminación de archivos en R2.

---

### Requirement 19: Configuración y Personalización por Tenant

**User Story:** Como administrador del taller, quiero personalizar la configuración de mi taller en el sistema, para adaptar el software a mis procesos específicos.

#### Acceptance Criteria

1. THE Platform SHALL permitir a un Tenant configurar: nombre comercial, NIT/RUT, logo (almacenado en Cloudflare R2), dirección, teléfono principal, email de contacto y horarios de atención.
2. THE Platform SHALL permitir configurar el porcentaje de IVA aplicado en Quotes y WorkOrders, con valor por defecto del 19% para Colombia.
3. THE Platform SHALL permitir configurar la fecha y hora de inicio del período contable mensual para el cálculo de métricas del Dashboard.
4. THE Platform SHALL permitir configurar los mensajes automáticos de WhatsApp por estado de WorkOrder con soporte de variables dinámicas: `{customer_name}`, `{vehicle_plate}`, `{work_order_number}`, `{estimated_delivery}`.
5. THE Platform SHALL permitir configurar el horario de atención del taller para determinar cuándo el AIAgent puede responder automáticamente.
6. WHEN un Tenant actualiza su logo, THE Platform SHALL reemplazar el archivo anterior en Cloudflare R2 y reflejar el cambio en nuevas Quotes generadas desde ese momento.

---

### Requirement 20: Notificaciones Internas del Sistema

**User Story:** Como recepcionista o técnico, quiero recibir notificaciones dentro del sistema sobre eventos importantes, para reaccionar a tiempo sin depender de canales externos.

#### Acceptance Criteria

1. THE Platform SHALL generar notificaciones internas para los eventos: WorkOrder próxima a vencer (≤ 2 horas) → OWNER, ADMIN; WorkOrder asignada a un Technician → TECHNICIAN asignado; stock de Part bajo el mínimo → OWNER, ADMIN; Payment registrado → ADMIN; mensaje WhatsApp sin responder en más de 5 minutos → RECEPTIONIST.
2. WHEN se genera una notificación, THE Platform SHALL entregarla en tiempo real al usuario destinatario mediante WebSocket o Server-Sent Events.
3. THE Platform SHALL marcar notificaciones como leídas cuando el usuario las visualiza, manteniendo historial de las últimas 100 notificaciones por usuario.
4. THE Platform SHALL mostrar un indicador de conteo de notificaciones no leídas en la barra de navegación principal.
5. IF la conexión WebSocket se pierde, THEN THE Platform SHALL recuperar las notificaciones pendientes al reconectarse sin duplicarlas.

---

### Requirement 21: Auditoría y Cumplimiento

**User Story:** Como administrador del taller, quiero un registro completo de todas las acciones realizadas, para cumplir con requisitos legales y resolver disputas con clientes.

#### Acceptance Criteria

1. THE Platform SHALL registrar en un log de auditoría inmutable cada operación de escritura con: entity_type, entity_id, action (CREATE/UPDATE/DELETE), actor_user_id, tenant_id, branch_id, timestamp, datos anteriores y datos nuevos en formato JSON.
2. THE Platform SHALL retener logs de auditoría por mínimo 2 años sin posibilidad de eliminación por parte de usuarios del Tenant.
3. THE Platform SHALL permitir a usuarios con Role OWNER consultar el log de auditoría filtrado por entidad, usuario, acción y rango de fechas.
4. WHEN se elimina lógicamente un Customer, Vehicle o WorkOrder (campo `deleted_at`), THE Platform SHALL preservar todos sus datos, archivos en Cloudflare R2 y registros de auditoría asociados sin eliminación física.
5. THE Platform SHALL registrar todos los accesos fallidos de autenticación con: email intentado, IP de origen, timestamp y tenant_id (si aplica), para detección de intentos no autorizados.

---

### Requirement 22: Preparación para Expansión Futura

**User Story:** Como Product Owner, quiero que la arquitectura esté preparada para soportar la venta de motocicletas y agentes IA especializados en fases posteriores, sin refactorizaciones mayores.

#### Acceptance Criteria

1. THE Platform SHALL definir en el modelo de dominio las entidades base `MotorcycleUnit` y `SaleOrder` con atributos mínimos sin implementar la funcionalidad en Fase 1.
2. THE Platform SHALL estructurar el módulo de inventario para soportar tanto Parts (repuestos) como MotorcycleUnits (unidades de venta) bajo el mismo patrón de gestión de stock.
3. THE Platform SHALL mantener el módulo de Customers compatible con flujos de venta (prospecto, comprador) mediante extensión de atributos sin modificar entidades existentes.
4. THE Platform SHALL garantizar que el sistema de permisos soporte nuevos módulos mediante adición de recursos y acciones, sin modificar el esquema de roles existente.
5. THE Platform SHALL estar preparada para incorporar en Fase 2 los agentes especializados: CommercialAgent, WorkshopAgent, FinancialAgent y ManagementAgent, y en Fase 3 un SupervisorAgent de orquestación multiagente, sin modificar la arquitectura de Tools de Fase 1.
6. THE Platform SHALL definir la abstracción `InvoiceProvider` en la capa de infraestructura para futura integración con DIAN, sin implementarla en Fase 1.

---

## Architecture Notes

Las siguientes notas documentan restricciones de arquitectura que derivan de los principios obligatorios del sistema.

**Stack tecnológico obligatorio:**
- Frontend: Next.js + TypeScript + TailwindCSS + shadcn/ui, desplegado en Cloudflare Pages
- Backend: NestJS + TypeScript, desplegado en Docker
- Base de datos: PostgreSQL en Neon, gestionado con Prisma ORM
- Storage: Cloudflare R2
- Colas asíncronas: BullMQ
- Caché: Redis
- Observabilidad: Sentry
- WhatsApp: Meta WhatsApp Cloud API
- LLM primario: DeepSeek | LLM secundario: Groq

**Principios no negociables:**
- Clean Architecture con capas explícitas: domain → application → infrastructure → presentation
- DDD: entidades, objetos de valor, agregados y repositorios
- SOLID en todos los módulos
- TypeScript Strict Mode (`strict: true`) en todo el código fuente
- Ningún agente accede directamente a la base de datos
- Toda lógica de negocio vive en Use Cases
- Toda IA interactúa mediante Tools tipadas
- El sistema opera sin degradación funcional si la IA falla

**Gestión de inventario (modelo de tres niveles):**
- `stock_fisico`: cantidad física real en bodega
- `stock_reservado`: comprometido por WorkOrders activas
- `stock_disponible` = `stock_fisico` − `stock_reservado`: cantidad vendible mostrada al usuario

**Política de archivos:**
- Todas las URLs pre-firmadas tienen expiración de 24 horas sin excepciones
- Los archivos en Cloudflare R2 no se eliminan físicamente cuando se hace soft delete de su recurso padre
- La única excepción de reemplazo físico es el logo del Tenant

**Soft delete:**
- Customers, Vehicles y WorkOrders usan soft delete con campo `deleted_at`
- Los archivos asociados se conservan en Cloudflare R2 para auditoría y protección legal

**Precios históricos:**
- El precio de un Part queda congelado al momento de agregarlo a una WorkOrder
- Cambios posteriores en el catálogo no afectan órdenes históricas

**Métricas financieras:**
- Los ingresos del Dashboard se calculan usando Payments registrados, no solo WorkOrders cerradas

**Idioma del negocio:**
- El dominio, los mensajes al usuario y los documentos generados están en español latinoamericano

**Preparación futura (Fase 1 establece las bases):**
- Multi-sucursal y multi-tenant operativos desde el primer día
- Entidades MotorcycleUnit y SaleOrder definidas en dominio, sin implementar
- Abstracción InvoiceProvider definida, sin implementar
- Arquitectura de agentes preparada para Fase 2 (agentes especializados) y Fase 3 (SupervisorAgent)

