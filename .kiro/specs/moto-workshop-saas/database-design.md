# Database Design — MotoWorkshop SaaS

---

## Principios de Diseño

- **Multi-tenant por campo**: `tenant_id` en cada tabla, nunca schemas separados (Neon Serverless no optimiza schemas múltiples).
- **Soft delete**: `deleted_at TIMESTAMPTZ` en entidades principales; filtrar con `WHERE deleted_at IS NULL` en todas las queries.
- **UUIDs**: todos los IDs son `UUID` generados en la aplicación (`crypto.randomUUID()`).
- **Timestamps**: `created_at` y `updated_at` en todas las tablas; `updated_at` se actualiza automáticamente vía trigger o Prisma middleware.
- **Índices**: obligatorios sobre `tenant_id`, `branch_id`, `deleted_at`, y campos de búsqueda frecuente.
- **Precios**: `DECIMAL(12,2)` para todos los valores monetarios.

---

## Diagrama Entidad-Relación (simplificado)

```
tenants ──< branches ──< users
    │                        │
    │                        │ (role)
    │                   roles ──< role_permissions
    │
    ├──< customers ──< vehicles
    │         │            │
    │         │       vehicle_ownership_history
    │         │
    │    vehicle_receptions ──< reception_photos
    │         │
    │         ▼
    │    work_orders ──< work_order_lines
    │         │      ──< work_order_parts
    │         │      ──< work_order_status_history
    │         │      ──< photo_evidences
    │         │      ──< quotes ──< quote_versions
    │         └──────< payments
    │
    ├──< parts ──< part_branch_stocks
    │         └──< stock_entries
    │
    ├──< whatsapp_sessions ──< messages
    │
    ├──< notifications
    └──< audit_logs
```

---

## Esquema Completo

### `tenants`
```sql
CREATE TABLE tenants (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    VARCHAR(255) NOT NULL,
  tax_id                  VARCHAR(50) NOT NULL UNIQUE,
  logo_url                TEXT,
  address                 TEXT,
  phone                   VARCHAR(50),
  email                   VARCHAR(255),
  vat_percentage          DECIMAL(5,2) NOT NULL DEFAULT 19.00,
  accounting_period_start SMALLINT NOT NULL DEFAULT 1, -- día 1-31
  whatsapp_phone          VARCHAR(50),
  whatsapp_token          TEXT, -- cifrado en aplicación
  business_hours          JSONB, -- { mon: {open: "08:00", close: "18:00"}, ... }
  terms_and_conditions    TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `branches`
```sql
CREATE TABLE branches (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id),
  name       VARCHAR(255) NOT NULL,
  address    TEXT NOT NULL,
  phone      VARCHAR(50),
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, name)
);
CREATE INDEX idx_branches_tenant ON branches(tenant_id);
```

### `roles`
```sql
CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  name        VARCHAR(100) NOT NULL,
  is_system   BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE para roles predefinidos
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, name)
);
CREATE INDEX idx_roles_tenant ON roles(tenant_id);
```

### `role_permissions`
```sql
CREATE TABLE role_permissions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id    UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  module     VARCHAR(100) NOT NULL, -- customers, vehicles, work_orders, inventory, quotes, payments, reports
  action     VARCHAR(20) NOT NULL,  -- CREATE, READ, UPDATE, DELETE
  UNIQUE (role_id, module, action)
);
CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
```

### `users`
```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  branch_id     UUID REFERENCES branches(id),
  role_id       UUID NOT NULL REFERENCES roles(id),
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(255) NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, email)
);
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_role ON users(role_id);
```

### `refresh_tokens`
```sql
CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
```


### `customers`
```sql
CREATE TABLE customers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id),
  full_name        VARCHAR(255) NOT NULL,
  document_type    VARCHAR(20) NOT NULL CHECK (document_type IN ('CC','NIT','CE','PASSPORT')),
  document_number  VARCHAR(50) NOT NULL,
  phone            VARCHAR(50) NOT NULL,
  whatsapp_phone   VARCHAR(50),
  email            VARCHAR(255),
  address          TEXT,
  city             VARCHAR(100) NOT NULL,
  birth_date       DATE,
  observations     TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  first_visit_at   TIMESTAMPTZ,
  last_visit_at    TIMESTAMPTZ,
  visit_count      INT NOT NULL DEFAULT 0, -- solo WorkOrders DELIVERED
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, document_number)
);
CREATE INDEX idx_customers_tenant ON customers(tenant_id, deleted_at);
CREATE INDEX idx_customers_document ON customers(tenant_id, document_number);
CREATE INDEX idx_customers_phone ON customers(tenant_id, phone);
CREATE INDEX idx_customers_whatsapp ON customers(tenant_id, whatsapp_phone);
```

### `vehicles`
```sql
CREATE TABLE vehicles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  plate             VARCHAR(20) NOT NULL,
  brand             VARCHAR(100) NOT NULL,
  model             VARCHAR(100) NOT NULL,
  year              SMALLINT NOT NULL,
  color             VARCHAR(50) NOT NULL,
  engine_number     VARCHAR(100) NOT NULL,
  chassis_number    VARCHAR(100),
  displacement      INT,
  fuel_type         VARCHAR(30),
  current_odometer  INT,
  observations      TEXT,
  current_owner_id  UUID NOT NULL REFERENCES customers(id),
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, plate)
);
CREATE INDEX idx_vehicles_tenant ON vehicles(tenant_id, deleted_at);
CREATE INDEX idx_vehicles_owner ON vehicles(current_owner_id);
CREATE INDEX idx_vehicles_plate ON vehicles(tenant_id, plate);
```

### `vehicle_ownership_history`
```sql
CREATE TABLE vehicle_ownership_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id      UUID NOT NULL REFERENCES vehicles(id),
  previous_owner  UUID NOT NULL REFERENCES customers(id),
  new_owner       UUID NOT NULL REFERENCES customers(id),
  transferred_at  TIMESTAMPTZ NOT NULL,
  transferred_by  UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ownership_vehicle ON vehicle_ownership_history(vehicle_id);
```

### `vehicle_receptions`
```sql
CREATE TABLE vehicle_receptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id),
  branch_id           UUID NOT NULL REFERENCES branches(id),
  vehicle_id          UUID NOT NULL REFERENCES vehicles(id),
  customer_id         UUID NOT NULL REFERENCES customers(id),
  received_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  received_by         UUID NOT NULL REFERENCES users(id),
  odometer_reading    INT NOT NULL,
  fuel_level          VARCHAR(20) NOT NULL CHECK (fuel_level IN ('EMPTY','QUARTER','HALF','THREE_QUARTERS','FULL')),
  observations        TEXT,
  visible_damage_notes TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_receptions_tenant ON vehicle_receptions(tenant_id);
CREATE INDEX idx_receptions_vehicle ON vehicle_receptions(vehicle_id);
```

### `reception_photos`
```sql
CREATE TABLE reception_photos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reception_id UUID NOT NULL REFERENCES vehicle_receptions(id),
  r2_key       TEXT NOT NULL,
  filename     VARCHAR(255) NOT NULL,
  size_bytes   INT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_reception_photos_reception ON reception_photos(reception_id);
```

### `work_orders`
```sql
CREATE TABLE work_orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id),
  branch_id           UUID NOT NULL REFERENCES branches(id),
  order_number        VARCHAR(20) NOT NULL,
  reception_id        UUID NOT NULL REFERENCES vehicle_receptions(id),
  vehicle_id          UUID NOT NULL REFERENCES vehicles(id),
  customer_id         UUID NOT NULL REFERENCES customers(id),
  technician_id       UUID NOT NULL REFERENCES users(id),
  service_type        VARCHAR(30) NOT NULL CHECK (service_type IN ('MAINTENANCE','REPAIR','INSPECTION','CUSTOMIZATION')),
  problem_description TEXT NOT NULL,
  status              VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  promised_delivery_at TIMESTAMPTZ NOT NULL,
  final_odometer      INT,
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, order_number)
);
CREATE INDEX idx_work_orders_tenant ON work_orders(tenant_id, deleted_at);
CREATE INDEX idx_work_orders_branch ON work_orders(branch_id, status);
CREATE INDEX idx_work_orders_customer ON work_orders(customer_id);
CREATE INDEX idx_work_orders_vehicle ON work_orders(vehicle_id);
CREATE INDEX idx_work_orders_technician ON work_orders(technician_id);
CREATE INDEX idx_work_orders_status ON work_orders(tenant_id, status, deleted_at);
CREATE INDEX idx_work_orders_delivery ON work_orders(promised_delivery_at, status);
```

### `work_order_status_history`
```sql
CREATE TABLE work_order_status_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id),
  from_status  VARCHAR(20),
  to_status    VARCHAR(20) NOT NULL,
  changed_by   UUID NOT NULL REFERENCES users(id),
  note         TEXT,
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_wo_status_history_order ON work_order_status_history(work_order_id);
```

### `work_order_lines`
```sql
CREATE TABLE work_order_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id   UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  description     TEXT NOT NULL,
  estimated_hours DECIMAL(6,2),
  unit_price      DECIMAL(12,2) NOT NULL,
  technician_id   UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_wo_lines_order ON work_order_lines(work_order_id);
```

### `work_order_parts`
```sql
CREATE TABLE work_order_parts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id     UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  part_id           UUID NOT NULL REFERENCES parts(id),
  quantity          DECIMAL(10,3) NOT NULL,
  unit_price_at_sale DECIMAL(12,2) NOT NULL, -- precio congelado al momento de adición
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_wo_parts_order ON work_order_parts(work_order_id);
CREATE INDEX idx_wo_parts_part ON work_order_parts(part_id);
```


### `photo_evidences`
```sql
CREATE TABLE photo_evidences (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id),
  r2_key        TEXT NOT NULL,
  filename      VARCHAR(255) NOT NULL,
  size_bytes    INT NOT NULL,
  phase         VARCHAR(20) NOT NULL CHECK (phase IN ('INGRESO','PROCESO','ENTREGA')),
  description   TEXT,
  uploaded_by   UUID NOT NULL REFERENCES users(id),
  deleted_at    TIMESTAMPTZ, -- soft delete; archivo R2 no se elimina físicamente
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_photo_evidences_order ON photo_evidences(work_order_id, deleted_at);
```

### `parts`
```sql
CREATE TABLE parts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id),
  sku                 VARCHAR(100) NOT NULL,
  name                VARCHAR(255) NOT NULL,
  category            VARCHAR(100) NOT NULL,
  unit                VARCHAR(30) NOT NULL,
  cost_price          DECIMAL(12,2) NOT NULL,
  sale_price          DECIMAL(12,2) NOT NULL,
  description         TEXT,
  brand               VARCHAR(100),
  supplier_reference  VARCHAR(100),
  image_url           TEXT,
  min_stock_alert     DECIMAL(10,3),
  warehouse_location  VARCHAR(100),
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, sku)
);
CREATE INDEX idx_parts_tenant ON parts(tenant_id);
CREATE INDEX idx_parts_sku ON parts(tenant_id, sku);
```

### `part_branch_stocks`
```sql
CREATE TABLE part_branch_stocks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id          UUID NOT NULL REFERENCES parts(id),
  branch_id        UUID NOT NULL REFERENCES branches(id),
  stock_fisico     DECIMAL(10,3) NOT NULL DEFAULT 0 CHECK (stock_fisico >= 0),
  stock_reservado  DECIMAL(10,3) NOT NULL DEFAULT 0 CHECK (stock_reservado >= 0),
  -- stock_disponible = stock_fisico - stock_reservado (columna generada)
  stock_disponible DECIMAL(10,3) GENERATED ALWAYS AS (stock_fisico - stock_reservado) STORED,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (part_id, branch_id),
  CHECK (stock_reservado <= stock_fisico)
);
CREATE INDEX idx_part_stocks_branch ON part_branch_stocks(branch_id);
CREATE INDEX idx_part_stocks_part ON part_branch_stocks(part_id);
CREATE INDEX idx_part_stocks_low ON part_branch_stocks(branch_id, stock_disponible);
```

### `stock_entries`
```sql
CREATE TABLE stock_entries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id),
  part_id      UUID NOT NULL REFERENCES parts(id),
  branch_id    UUID NOT NULL REFERENCES branches(id),
  type         VARCHAR(20) NOT NULL CHECK (type IN ('ENTRADA','SALIDA','AJUSTE','RESERVA','LIBERACION')),
  quantity     DECIMAL(10,3) NOT NULL,
  user_id      UUID NOT NULL REFERENCES users(id),
  reference_id UUID, -- FK → work_orders o NULL si es ajuste manual
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_stock_entries_tenant ON stock_entries(tenant_id);
CREATE INDEX idx_stock_entries_part_branch ON stock_entries(part_id, branch_id);
CREATE INDEX idx_stock_entries_created ON stock_entries(created_at);
```

### `quotes`
```sql
CREATE TABLE quotes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id),
  work_order_id      UUID NOT NULL REFERENCES work_orders(id),
  quote_number       VARCHAR(20) NOT NULL,
  status             VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SENT','APPROVED','REJECTED','EXPIRED')),
  subtotal           DECIMAL(12,2) NOT NULL,
  vat_percentage     DECIMAL(5,2) NOT NULL,
  vat_amount         DECIMAL(12,2) NOT NULL,
  total              DECIMAL(12,2) NOT NULL,
  valid_until        TIMESTAMPTZ NOT NULL,
  pdf_r2_key         TEXT,
  terms_conditions   TEXT,
  version            INT NOT NULL DEFAULT 1,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, quote_number)
);
CREATE INDEX idx_quotes_tenant ON quotes(tenant_id);
CREATE INDEX idx_quotes_work_order ON quotes(work_order_id);
CREATE INDEX idx_quotes_status ON quotes(status, valid_until);
```

### `quote_versions`
```sql
CREATE TABLE quote_versions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id     UUID NOT NULL REFERENCES quotes(id),
  version      INT NOT NULL,
  pdf_r2_key   TEXT NOT NULL,
  snapshot     JSONB NOT NULL, -- snapshot completo de la cotización en esa versión
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (quote_id, version)
);
CREATE INDEX idx_quote_versions_quote ON quote_versions(quote_id);
```

### `payments`
```sql
CREATE TABLE payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id),
  work_order_id  UUID NOT NULL REFERENCES work_orders(id),
  amount         DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('CASH','TRANSFER','CARD','OTHER')),
  reference      VARCHAR(255),
  notes          TEXT,
  paid_at        TIMESTAMPTZ NOT NULL,
  created_by     UUID NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_payments_tenant ON payments(tenant_id);
CREATE INDEX idx_payments_work_order ON payments(work_order_id);
CREATE INDEX idx_payments_paid_at ON payments(tenant_id, paid_at);
```

### `whatsapp_sessions`
```sql
CREATE TABLE whatsapp_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  customer_id     UUID REFERENCES customers(id),
  phone_number    VARCHAR(50) NOT NULL,
  is_anonymous    BOOLEAN NOT NULL DEFAULT FALSE,
  last_message_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, phone_number)
);
CREATE INDEX idx_wa_sessions_tenant ON whatsapp_sessions(tenant_id);
CREATE INDEX idx_wa_sessions_customer ON whatsapp_sessions(customer_id);
```

### `messages`
```sql
CREATE TABLE messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES whatsapp_sessions(id),
  direction    VARCHAR(10) NOT NULL CHECK (direction IN ('INBOUND','OUTBOUND')),
  content      TEXT NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'SENT' CHECK (status IN ('SENT','DELIVERED','READ','FAILED')),
  wa_message_id VARCHAR(255), -- ID de Meta WhatsApp
  sent_by      UUID REFERENCES users(id), -- NULL si fue enviado por AIAgent o automático
  is_ai        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_messages_session ON messages(session_id, created_at);
```

### `notifications`
```sql
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  user_id     UUID NOT NULL REFERENCES users(id),
  type        VARCHAR(50) NOT NULL,
  title       VARCHAR(255) NOT NULL,
  body        TEXT NOT NULL,
  resource_type VARCHAR(50),  -- work_orders, parts, payments, messages
  resource_id   UUID,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_tenant ON notifications(tenant_id);
```

### `audit_logs`
```sql
CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,  -- sin FK para preservar si Tenant se elimina
  branch_id     UUID,
  actor_user_id UUID,
  entity_type   VARCHAR(100) NOT NULL,
  entity_id     UUID NOT NULL,
  action        VARCHAR(20) NOT NULL CHECK (action IN ('CREATE','UPDATE','DELETE')),
  previous_data JSONB,
  new_data      JSONB,
  ip_address    INET,
  trace_id      UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_user_id, created_at DESC);
```

### `auth_failure_logs`
```sql
CREATE TABLE auth_failure_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID,
  email       VARCHAR(255),
  ip_address  INET NOT NULL,
  reason      VARCHAR(100),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_auth_failures_ip ON auth_failure_logs(ip_address, created_at DESC);
CREATE INDEX idx_auth_failures_email ON auth_failure_logs(email, created_at DESC);
```

---

## Índices de Rendimiento — Resumen

Los índices críticos para las queries del Dashboard y búsquedas frecuentes:

```sql
-- Dashboard: órdenes por estado en Branch
CREATE INDEX idx_wo_branch_status ON work_orders(branch_id, status, deleted_at, created_at DESC);

-- Dashboard: pagos por fecha para métricas financieras
CREATE INDEX idx_payments_branch_date ON payments(tenant_id, paid_at DESC);

-- Búsqueda de cliente por nombre (ilike)
CREATE INDEX idx_customers_fulltext ON customers USING GIN(to_tsvector('spanish', full_name));

-- Stock bajo: query de alertas
CREATE INDEX idx_stock_alert ON part_branch_stocks(branch_id, stock_disponible)
  WHERE stock_disponible <= (SELECT min_stock_alert FROM parts WHERE parts.id = part_id);
```

---

## Notas sobre Neon PostgreSQL

- Usar **connection pooling** vía Neon Serverless driver para NestJS en producción.
- Configurar **branches** de Neon para entornos: `main` (producción), `dev`, `staging`.
- Las migraciones se gestionan con `prisma migrate deploy` en CI/CD.
- Los backups automáticos de Neon cubren la retención de 7 días; los `audit_logs` son la fuente de verdad para retención de 2 años.
