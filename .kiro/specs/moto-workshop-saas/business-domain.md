# Business Domain — MotoWorkshop SaaS

---

## Bounded Contexts

El sistema se organiza en los siguientes Bounded Contexts. Cada uno tiene su propio modelo de dominio y se comunica con los demás a través de interfaces explícitas.

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│   Identity &        │     │   Workshop &          │     │   Inventory &       │
│   Access            │     │   Operations          │     │   Parts             │
│                     │     │                       │     │                     │
│  Tenant             │     │  VehicleReception     │     │  Part               │
│  Branch             │     │  WorkOrder            │     │  StockEntry         │
│  User               │     │  WorkOrderLine        │     │  PartBranchStock    │
│  Role               │     │  WorkOrderPart        │     │  StockTransfer      │
│  Permission         │     │  PhotoEvidence        │     │                     │
└─────────────────────┘     │  ServiceType          │     └──────────────────────┘
                            └──────────────────────┘
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│   Customer &        │     │   Commerce &          │     │   Communication &   │
│   Vehicles          │     │   Finance             │     │   AI                │
│                     │     │                       │     │                     │
│  Customer           │     │  Quote                │     │  WhatsAppSession    │
│  Vehicle            │     │  Payment              │     │  Message            │
│  VehicleOwnership   │     │  InvoiceProvider(abs) │     │  AIAgent (Router)   │
│                     │     │  MotorcycleUnit(base) │     │  Tool               │
│                     │     │  SaleOrder(base)      │     │  Notification       │
└─────────────────────┘     └──────────────────────┘     └─────────────────────┘
```

---

## Entidades de Dominio

### Tenant
Organización que contrata el servicio. Punto de aislamiento máximo de datos.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | Identificador único |
| name | string | Nombre comercial |
| taxId | string | NIT o RUT |
| logoUrl | string? | URL del logo en R2 |
| address | string? | Dirección principal |
| phone | string? | Teléfono principal |
| email | string? | Email de contacto |
| vatPercentage | decimal | IVA aplicado (default: 19%) |
| accountingPeriodStart | int | Día de inicio período contable (1-31) |
| createdAt | DateTime | Fecha de creación |

---

### Branch
Sucursal física de un Tenant.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | |
| tenantId | UUID | FK → Tenant |
| name | string | Nombre de la sucursal |
| address | string | Dirección física |
| phone | string? | Teléfono de la sucursal |
| isActive | boolean | Estado activo/inactivo |
| createdAt | DateTime | |

---

### User
Empleado del Tenant con acceso al sistema. Un Technician es un User con Role TECHNICIAN.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | |
| tenantId | UUID | FK → Tenant |
| email | string | Email único por Tenant |
| passwordHash | string | Hash de contraseña |
| fullName | string | Nombre completo |
| roleId | UUID | FK → Role |
| branchId | UUID? | Branch principal asignada |
| isActive | boolean | |
| createdAt | DateTime | |

---

### Role / Permission
Roles predefinidos: OWNER, ADMIN, RECEPTIONIST, TECHNICIAN, VIEWER. Roles personalizados permitidos.

---

### Customer
Persona natural o jurídica propietaria de vehículos en el taller.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | |
| tenantId | UUID | FK → Tenant |
| fullName | string | |
| documentType | enum | CC, NIT, CE, PASSPORT |
| documentNumber | string | Único por Tenant |
| phone | string | Teléfono principal |
| whatsappPhone | string? | Puede diferir del teléfono principal |
| email | string? | |
| address | string? | |
| city | string | |
| birthDate | Date? | |
| observations | string? | |
| firstVisitAt | DateTime? | Calculado automáticamente |
| lastVisitAt | DateTime? | Calculado al completar WorkOrder |
| visitCount | int | WorkOrders en estado DELIVERED |
| isActive | boolean | |
| deletedAt | DateTime? | Soft delete |
| createdAt | DateTime | |

---

### Vehicle
Motocicleta registrada en el sistema.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | |
| tenantId | UUID | FK → Tenant |
| plate | string | Placa única por Tenant |
| brand | string | Marca |
| model | string | Modelo |
| year | int | Año de fabricación |
| color | string | |
| engineNumber | string | |
| chassisNumber | string? | |
| displacement | int? | Cilindraje en cc |
| fuelType | string? | |
| currentOdometer | int? | Último kilometraje registrado |
| observations | string? | |
| currentOwnerId | UUID | FK → Customer (propietario actual) |
| deletedAt | DateTime? | Soft delete |
| createdAt | DateTime | |

---

### VehicleReception
Registro formal del estado del vehículo al ingresar al taller. Precede obligatoriamente a toda WorkOrder.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | |
| tenantId | UUID | FK → Tenant |
| branchId | UUID | FK → Branch |
| vehicleId | UUID | FK → Vehicle |
| customerId | UUID | FK → Customer |
| receivedAt | DateTime | Fecha y hora de recepción |
| receivedBy | UUID | FK → User (recepcionista) |
| odometerReading | int | Lectura de odómetro al ingreso |
| fuelLevel | enum | EMPTY, QUARTER, HALF, THREE_QUARTERS, FULL |
| observations | string? | Observaciones generales |
| visibleDamageNotes | string? | Descripción de daños visibles |
| photoUrls | string[] | URLs de fotos en R2 |
| createdAt | DateTime | |


---

### WorkOrder
Orden de trabajo sobre un vehículo, originada siempre desde una VehicleReception.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | |
| tenantId | UUID | FK → Tenant |
| branchId | UUID | FK → Branch |
| orderNumber | string | Formato: WO-{YYYY}-{NNNNNN} |
| receptionId | UUID | FK → VehicleReception |
| vehicleId | UUID | FK → Vehicle |
| customerId | UUID | FK → Customer |
| technicianId | UUID | FK → User (técnico principal) |
| serviceType | enum | MAINTENANCE, REPAIR, INSPECTION, CUSTOMIZATION |
| problemDescription | string | |
| status | enum | PENDING, IN_PROGRESS, WAITING_PARTS, COMPLETED, DELIVERED, CANCELLED |
| promisedDeliveryAt | DateTime | Fecha prometida de entrega (obligatorio) |
| finalOdometer | int? | Kilometraje al cierre |
| deletedAt | DateTime? | Soft delete |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Máquina de estados:**
```
PENDING → IN_PROGRESS → WAITING_PARTS → IN_PROGRESS → COMPLETED → DELIVERED
                ↓               ↓              ↓           ↓
            CANCELLED      CANCELLED      CANCELLED   CANCELLED (no desde DELIVERED)
```

---

### WorkOrderLine
Línea de servicio dentro de una WorkOrder.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | |
| workOrderId | UUID | FK → WorkOrder |
| description | string | Descripción del servicio |
| estimatedHours | decimal | |
| unitPrice | decimal | Precio congelado al momento de creación |
| technicianId | UUID | FK → User (puede diferir del técnico principal) |

---

### WorkOrderPart
Repuesto consumido en una WorkOrder con precio histórico congelado.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | |
| workOrderId | UUID | FK → WorkOrder |
| partId | UUID | FK → Part |
| quantity | decimal | |
| unitPriceAtSale | decimal | Precio congelado al momento de adición |

---

### Part
Repuesto o accesorio gestionado en el inventario.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | |
| tenantId | UUID | FK → Tenant |
| sku | string | Código único por Tenant |
| name | string | |
| category | string | |
| unit | string | Unidad de medida |
| costPrice | decimal | Precio de costo actual |
| salePrice | decimal | Precio de venta actual (no afecta órdenes históricas) |
| description | string? | |
| brand | string? | |
| supplierReference | string? | |
| imageUrl | string? | URL en R2 |
| minStockAlert | decimal? | Umbral de alerta de stock bajo |
| warehouseLocation | string? | Ubicación física en bodega |
| isActive | boolean | |
| createdAt | DateTime | |

---

### PartBranchStock
Stock de un Part en una Branch específica (tres niveles).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | |
| partId | UUID | FK → Part |
| branchId | UUID | FK → Branch |
| stockFisico | decimal | Cantidad física real |
| stockReservado | decimal | Comprometido por WorkOrders activas |
| stockDisponible | decimal | Calculado: stockFisico - stockReservado |

---

### StockEntry
Movimiento de inventario de un Part en una Branch.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | |
| tenantId | UUID | FK → Tenant |
| partId | UUID | FK → Part |
| branchId | UUID | FK → Branch |
| type | enum | ENTRADA, SALIDA, AJUSTE, RESERVA, LIBERACION |
| quantity | decimal | Positivo (entrada) o negativo (salida) |
| userId | UUID | FK → User responsable |
| referenceId | UUID? | FK → WorkOrder o null si es manual |
| notes | string? | Justificación para ajustes |
| createdAt | DateTime | |

---

### Quote
Cotización formal generada desde una WorkOrder.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | |
| tenantId | UUID | FK → Tenant |
| workOrderId | UUID | FK → WorkOrder |
| quoteNumber | string | Formato: Q-{YYYY}-{NNNNNN} |
| status | enum | DRAFT, SENT, APPROVED, REJECTED, EXPIRED |
| subtotal | decimal | |
| vatPercentage | decimal | IVA aplicado |
| vatAmount | decimal | |
| total | decimal | |
| validUntil | DateTime | Fecha de vencimiento de la cotización |
| pdfUrl | string? | URL en R2 (pre-firmada, 24h) |
| termsAndConditions | string? | |
| version | int | Versión actual (incrementa con cada modificación) |
| createdAt | DateTime | |
| updatedAt | DateTime | |

---

### Payment
Pago registrado manualmente para una WorkOrder.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | |
| tenantId | UUID | FK → Tenant |
| workOrderId | UUID | FK → WorkOrder |
| amount | decimal | Monto del pago |
| paymentMethod | enum | CASH, TRANSFER, CARD, OTHER |
| reference | string? | Número de transacción o comprobante |
| notes | string? | |
| paidAt | DateTime | Fecha y hora del pago |
| createdBy | UUID | FK → User que registró el pago |
| createdAt | DateTime | |

---

### WhatsAppSession
Sesión de conversación con un Customer (o número desconocido) vía WhatsApp.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | |
| tenantId | UUID | FK → Tenant |
| customerId | UUID? | FK → Customer (null si número desconocido) |
| phoneNumber | string | Número de WhatsApp del interlocutor |
| isAnonymous | boolean | true si número no está registrado como Customer |
| lastMessageAt | DateTime | Timestamp del último mensaje |
| createdAt | DateTime | |

---

## Reglas de Dominio Clave

1. Una WorkOrder **siempre** tiene una VehicleReception asociada. No existen WorkOrders huérfanas.
2. Un Vehicle con WorkOrder activa (IN_PROGRESS o WAITING_PARTS) **no puede** recibir una nueva WorkOrder.
3. El precio de un Part en WorkOrderPart es **inmutable** después de su creación.
4. `stock_disponible` = `stock_fisico` - `stock_reservado`. Los usuarios **nunca** ven `stock_fisico` crudo.
5. Al agregar un Part a una WorkOrder se incrementa `stock_reservado`. Al pasar a DELIVERED se decrementa `stock_fisico` y `stock_reservado`.
6. Las visitas de un Customer se contabilizan **únicamente** cuando una WorkOrder alcanza DELIVERED.
7. El soft delete de Customer, Vehicle o WorkOrder **no elimina** archivos físicos en R2.
8. La asociación de un mensaje WhatsApp entrante usa `whatsappPhone` o `phone` del Customer — cualquiera de los dos hace match.
9. El AIAgent **no puede** consultar órdenes, historial ni pagos de un número desconocido hasta verificar identidad.
10. La transición DELIVERED → cualquier estado está **prohibida** sin excepción.

---

## Invariantes de Dominio

- `WorkOrder.status` solo puede evolucionar según la máquina de estados definida.
- `PartBranchStock.stockFisico` nunca puede ser negativo.
- `PartBranchStock.stockReservado` nunca puede exceder `stockFisico`.
- `Quote.version` es monotónico creciente; las versiones anteriores se conservan en R2.
- `Payment.amount` debe ser mayor que cero.
- `VehicleReception.odometerReading` debe ser ≥ al último odómetro registrado del vehículo (warning, no error bloqueante).
