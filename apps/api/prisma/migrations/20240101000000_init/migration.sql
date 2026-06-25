-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "taxId" VARCHAR(50) NOT NULL,
    "logoUrl" TEXT,
    "address" TEXT,
    "phone" VARCHAR(50),
    "email" VARCHAR(255),
    "vatPercentage" DECIMAL(5,2) NOT NULL DEFAULT 19.00,
    "accountingPeriodStart" SMALLINT NOT NULL DEFAULT 1,
    "whatsappPhone" VARCHAR(50),
    "whatsappToken" TEXT,
    "businessHours" JSONB,
    "termsAndConditions" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "address" TEXT NOT NULL,
    "phone" VARCHAR(50),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "module" VARCHAR(100) NOT NULL,
    "action" VARCHAR(20) NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "roleId" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "fullName" VARCHAR(255) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" VARCHAR(255) NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "revokedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_failure_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "email" VARCHAR(255),
    "ipAddress" VARCHAR(50) NOT NULL,
    "reason" VARCHAR(100),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_failure_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fullName" VARCHAR(255) NOT NULL,
    "documentType" VARCHAR(20) NOT NULL,
    "documentNumber" VARCHAR(50) NOT NULL,
    "phone" VARCHAR(50) NOT NULL,
    "whatsappPhone" VARCHAR(50),
    "email" VARCHAR(255),
    "address" TEXT,
    "city" VARCHAR(100) NOT NULL,
    "birthDate" DATE,
    "observations" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "firstVisitAt" TIMESTAMPTZ,
    "lastVisitAt" TIMESTAMPTZ,
    "visitCount" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "plate" VARCHAR(20) NOT NULL,
    "brand" VARCHAR(100) NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "year" SMALLINT NOT NULL,
    "color" VARCHAR(50) NOT NULL,
    "engineNumber" VARCHAR(100) NOT NULL,
    "chassisNumber" VARCHAR(100),
    "displacement" INTEGER,
    "fuelType" VARCHAR(30),
    "currentOdometer" INTEGER,
    "observations" TEXT,
    "currentOwnerId" TEXT NOT NULL,
    "deletedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_ownership_history" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "previousOwner" TEXT NOT NULL,
    "newOwner" TEXT NOT NULL,
    "transferredAt" TIMESTAMPTZ NOT NULL,
    "transferredBy" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_ownership_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_receptions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "receivedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedBy" TEXT NOT NULL,
    "odometerReading" INTEGER NOT NULL,
    "fuelLevel" VARCHAR(20) NOT NULL,
    "observations" TEXT,
    "visibleDamageNotes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_receptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reception_photos" (
    "id" TEXT NOT NULL,
    "receptionId" TEXT NOT NULL,
    "r2Key" TEXT NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reception_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_orders" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "orderNumber" VARCHAR(20) NOT NULL,
    "receptionId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "serviceType" VARCHAR(30) NOT NULL,
    "problemDescription" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "promisedDeliveryAt" TIMESTAMPTZ NOT NULL,
    "finalOdometer" INTEGER,
    "deletedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_status_history" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "fromStatus" VARCHAR(20),
    "toStatus" VARCHAR(20) NOT NULL,
    "changedBy" TEXT NOT NULL,
    "note" TEXT,
    "changedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_lines" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "estimatedHours" DECIMAL(6,2),
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "technicianId" TEXT,
    "serviceCatalogId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_parts" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unitPriceAtSale" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_evidences" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "r2Key" TEXT NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "phase" VARCHAR(20) NOT NULL,
    "description" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "deletedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photo_evidences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sku" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "unit" VARCHAR(30) NOT NULL,
    "costPrice" DECIMAL(12,2) NOT NULL,
    "salePrice" DECIMAL(12,2) NOT NULL,
    "description" TEXT,
    "brand" VARCHAR(100),
    "supplierReference" VARCHAR(100),
    "imageUrl" TEXT,
    "minStockAlert" DECIMAL(10,3),
    "warehouseLocation" VARCHAR(100),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "part_branch_stocks" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "stockFisico" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "stockReservado" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "part_branch_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_entries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "userId" TEXT NOT NULL,
    "referenceId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_catalog_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "estimatedHours" DECIMAL(6,2) NOT NULL,
    "suggestedPrice" DECIMAL(12,2) NOT NULL,
    "serviceType" VARCHAR(30) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "service_catalog_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "quoteNumber" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "vatPercentage" DECIMAL(5,2) NOT NULL,
    "vatAmount" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "validUntil" TIMESTAMPTZ NOT NULL,
    "pdfR2Key" TEXT,
    "termsConditions" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_versions" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "pdfR2Key" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentMethod" VARCHAR(20) NOT NULL,
    "reference" VARCHAR(255),
    "notes" TEXT,
    "paidAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_sessions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT,
    "phoneNumber" VARCHAR(50) NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "lastMessageAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "direction" VARCHAR(10) NOT NULL,
    "content" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'SENT',
    "waMessageId" VARCHAR(255),
    "sentBy" TEXT,
    "isAi" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "resourceType" VARCHAR(50),
    "resourceId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "actorUserId" TEXT,
    "entityType" VARCHAR(100) NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" VARCHAR(20) NOT NULL,
    "previousData" JSONB,
    "newData" JSONB,
    "ipAddress" VARCHAR(50),
    "traceId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex
CREATE UNIQUE INDEX "tenants_taxId_key" ON "tenants"("taxId");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "branches_tenantId_name_key" ON "branches"("tenantId", "name");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "roles_tenantId_name_key" ON "roles"("tenantId", "name");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "role_permissions_roleId_module_action_key" ON "role_permissions"("roleId", "module", "action");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "users_tenantId_email_key" ON "users"("tenantId", "email");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "customers_tenantId_documentNumber_key" ON "customers"("tenantId", "documentNumber");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "vehicles_tenantId_plate_key" ON "vehicles"("tenantId", "plate");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "work_orders_tenantId_orderNumber_key" ON "work_orders"("tenantId", "orderNumber");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "parts_tenantId_sku_key" ON "parts"("tenantId", "sku");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "part_branch_stocks_partId_branchId_key" ON "part_branch_stocks"("partId", "branchId");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "quotes_tenantId_quoteNumber_key" ON "quotes"("tenantId", "quoteNumber");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "quote_versions_quoteId_version_key" ON "quote_versions"("quoteId", "version");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "whatsapp_sessions_tenantId_phoneNumber_key" ON "whatsapp_sessions"("tenantId", "phoneNumber");

-- CreateIndex
CREATE INDEX "idx_branches_tenant" ON "branches"("tenantId");

-- CreateIndex
CREATE INDEX "idx_roles_tenant" ON "roles"("tenantId");

-- CreateIndex
CREATE INDEX "idx_role_permissions_role" ON "role_permissions"("roleId");

-- CreateIndex
CREATE INDEX "idx_users_tenant" ON "users"("tenantId");

-- CreateIndex
CREATE INDEX "idx_users_role" ON "users"("roleId");

-- CreateIndex
CREATE INDEX "idx_refresh_tokens_user" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "idx_auth_failures_ip" ON "auth_failure_logs"("ipAddress");

-- CreateIndex
CREATE INDEX "idx_auth_failures_email" ON "auth_failure_logs"("email");

-- CreateIndex
CREATE INDEX "idx_customers_tenant" ON "customers"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "idx_customers_document" ON "customers"("tenantId", "documentNumber");

-- CreateIndex
CREATE INDEX "idx_customers_phone" ON "customers"("tenantId", "phone");

-- CreateIndex
CREATE INDEX "idx_customers_whatsapp" ON "customers"("tenantId", "whatsappPhone");

-- CreateIndex
CREATE INDEX "idx_vehicles_tenant" ON "vehicles"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "idx_vehicles_owner" ON "vehicles"("currentOwnerId");

-- CreateIndex
CREATE INDEX "idx_vehicles_plate" ON "vehicles"("tenantId", "plate");

-- CreateIndex
CREATE INDEX "idx_ownership_vehicle" ON "vehicle_ownership_history"("vehicleId");

-- CreateIndex
CREATE INDEX "idx_receptions_tenant" ON "vehicle_receptions"("tenantId");

-- CreateIndex
CREATE INDEX "idx_receptions_vehicle" ON "vehicle_receptions"("vehicleId");

-- CreateIndex
CREATE INDEX "idx_reception_photos_reception" ON "reception_photos"("receptionId");

-- CreateIndex
CREATE INDEX "idx_work_orders_tenant" ON "work_orders"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "idx_work_orders_branch" ON "work_orders"("branchId", "status");

-- CreateIndex
CREATE INDEX "idx_work_orders_customer" ON "work_orders"("customerId");

-- CreateIndex
CREATE INDEX "idx_work_orders_vehicle" ON "work_orders"("vehicleId");

-- CreateIndex
CREATE INDEX "idx_work_orders_technician" ON "work_orders"("technicianId");

-- CreateIndex
CREATE INDEX "idx_work_orders_status" ON "work_orders"("tenantId", "status", "deletedAt");

-- CreateIndex
CREATE INDEX "idx_work_orders_delivery" ON "work_orders"("promisedDeliveryAt", "status");

-- CreateIndex
CREATE INDEX "idx_wo_branch_status" ON "work_orders"("branchId", "status", "deletedAt", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "idx_wo_status_history_order" ON "work_order_status_history"("workOrderId");

-- CreateIndex
CREATE INDEX "idx_wo_lines_order" ON "work_order_lines"("workOrderId");

-- CreateIndex
CREATE INDEX "idx_wo_parts_order" ON "work_order_parts"("workOrderId");

-- CreateIndex
CREATE INDEX "idx_wo_parts_part" ON "work_order_parts"("partId");

-- CreateIndex
CREATE INDEX "idx_photo_evidences_order" ON "photo_evidences"("workOrderId", "deletedAt");

-- CreateIndex
CREATE INDEX "idx_parts_tenant" ON "parts"("tenantId");

-- CreateIndex
CREATE INDEX "idx_parts_sku" ON "parts"("tenantId", "sku");

-- CreateIndex
CREATE INDEX "idx_part_stocks_branch" ON "part_branch_stocks"("branchId");

-- CreateIndex
CREATE INDEX "idx_part_stocks_part" ON "part_branch_stocks"("partId");

-- CreateIndex
CREATE INDEX "idx_stock_entries_tenant" ON "stock_entries"("tenantId");

-- CreateIndex
CREATE INDEX "idx_stock_entries_part_branch" ON "stock_entries"("partId", "branchId");

-- CreateIndex
CREATE INDEX "idx_stock_entries_created" ON "stock_entries"("createdAt");

-- CreateIndex
CREATE INDEX "idx_service_catalog_tenant" ON "service_catalog_items"("tenantId");

-- CreateIndex
CREATE INDEX "idx_quotes_tenant" ON "quotes"("tenantId");

-- CreateIndex
CREATE INDEX "idx_quotes_work_order" ON "quotes"("workOrderId");

-- CreateIndex
CREATE INDEX "idx_quotes_status" ON "quotes"("status", "validUntil");

-- CreateIndex
CREATE INDEX "idx_quote_versions_quote" ON "quote_versions"("quoteId");

-- CreateIndex
CREATE INDEX "idx_payments_tenant" ON "payments"("tenantId");

-- CreateIndex
CREATE INDEX "idx_payments_work_order" ON "payments"("workOrderId");

-- CreateIndex
CREATE INDEX "idx_payments_paid_at" ON "payments"("tenantId", "paidAt");

-- CreateIndex
CREATE INDEX "idx_payments_branch_date" ON "payments"("tenantId", "paidAt" DESC);

-- CreateIndex
CREATE INDEX "idx_wa_sessions_tenant" ON "whatsapp_sessions"("tenantId");

-- CreateIndex
CREATE INDEX "idx_wa_sessions_customer" ON "whatsapp_sessions"("customerId");

-- CreateIndex
CREATE INDEX "idx_messages_session" ON "messages"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_notifications_user" ON "notifications"("userId", "isRead", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "idx_notifications_tenant" ON "notifications"("tenantId");

-- CreateIndex
CREATE INDEX "idx_audit_logs_tenant" ON "audit_logs"("tenantId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "idx_audit_logs_entity" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "idx_audit_logs_actor" ON "audit_logs"("actorUserId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_currentOwnerId_fkey" FOREIGN KEY ("currentOwnerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_ownership_history" ADD CONSTRAINT "vehicle_ownership_history_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_ownership_history" ADD CONSTRAINT "vehicle_ownership_history_previousOwner_fkey" FOREIGN KEY ("previousOwner") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_ownership_history" ADD CONSTRAINT "vehicle_ownership_history_newOwner_fkey" FOREIGN KEY ("newOwner") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_ownership_history" ADD CONSTRAINT "vehicle_ownership_history_transferredBy_fkey" FOREIGN KEY ("transferredBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_receptions" ADD CONSTRAINT "vehicle_receptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_receptions" ADD CONSTRAINT "vehicle_receptions_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_receptions" ADD CONSTRAINT "vehicle_receptions_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_receptions" ADD CONSTRAINT "vehicle_receptions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_receptions" ADD CONSTRAINT "vehicle_receptions_receivedBy_fkey" FOREIGN KEY ("receivedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reception_photos" ADD CONSTRAINT "reception_photos_receptionId_fkey" FOREIGN KEY ("receptionId") REFERENCES "vehicle_receptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_receptionId_fkey" FOREIGN KEY ("receptionId") REFERENCES "vehicle_receptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_status_history" ADD CONSTRAINT "work_order_status_history_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_status_history" ADD CONSTRAINT "work_order_status_history_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_lines" ADD CONSTRAINT "work_order_lines_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_lines" ADD CONSTRAINT "work_order_lines_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_parts" ADD CONSTRAINT "work_order_parts_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_parts" ADD CONSTRAINT "work_order_parts_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_evidences" ADD CONSTRAINT "photo_evidences_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_evidences" ADD CONSTRAINT "photo_evidences_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parts" ADD CONSTRAINT "parts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_branch_stocks" ADD CONSTRAINT "part_branch_stocks_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_branch_stocks" ADD CONSTRAINT "part_branch_stocks_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_entries" ADD CONSTRAINT "stock_entries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_entries" ADD CONSTRAINT "stock_entries_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_entries" ADD CONSTRAINT "stock_entries_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_sessions" ADD CONSTRAINT "whatsapp_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_sessions" ADD CONSTRAINT "whatsapp_sessions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "whatsapp_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sentBy_fkey" FOREIGN KEY ("sentBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
