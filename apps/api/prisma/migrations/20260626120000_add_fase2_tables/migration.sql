-- AlterTable
ALTER TABLE "users" ADD COLUMN     "whatsappPhone" VARCHAR(50);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "periodStart" TIMESTAMPTZ NOT NULL,
    "periodEnd" TIMESTAMPTZ NOT NULL,
    "pdfR2Key" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "generatedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_service_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "customerId" TEXT,
    "customerName" VARCHAR(255) NOT NULL,
    "customerPhone" VARCHAR(50) NOT NULL,
    "address" TEXT NOT NULL,
    "problemDesc" TEXT NOT NULL,
    "serviceType" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "assignedTo" TEXT,
    "workOrderId" TEXT,
    "estimatedCost" DECIMAL(12,2),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "home_service_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_drafts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "items" JSONB NOT NULL,
    "notes" TEXT,
    "createdBy" VARCHAR(100) NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_order_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_reports_tenant" ON "reports"("tenantId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "idx_home_services_tenant" ON "home_service_requests"("tenantId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "idx_home_services_assignee" ON "home_service_requests"("assignedTo");

-- CreateIndex
CREATE INDEX "idx_po_drafts_tenant" ON "purchase_order_drafts"("tenantId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "idx_users_whatsapp" ON "users"("tenantId", "whatsappPhone");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_service_requests" ADD CONSTRAINT "home_service_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_service_requests" ADD CONSTRAINT "home_service_requests_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_service_requests" ADD CONSTRAINT "home_service_requests_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_service_requests" ADD CONSTRAINT "home_service_requests_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_service_requests" ADD CONSTRAINT "home_service_requests_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_drafts" ADD CONSTRAINT "purchase_order_drafts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
