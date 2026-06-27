-- CreateTable
CREATE TABLE "sale_orders" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "motorcycleUnitId" TEXT NOT NULL,
    "orderNumber" VARCHAR(30) NOT NULL,
    "salePrice" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "paymentMethod" VARCHAR(20) NOT NULL DEFAULT 'CASH',
    "downPayment" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "financingMonths" SMALLINT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdBy" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sale_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_sale_orders_status" ON "sale_orders"("tenantId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "idx_sale_orders_customer" ON "sale_orders"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "sale_orders_tenantId_orderNumber_key" ON "sale_orders"("tenantId", "orderNumber");

-- AddForeignKey
ALTER TABLE "sale_orders" ADD CONSTRAINT "sale_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_orders" ADD CONSTRAINT "sale_orders_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_orders" ADD CONSTRAINT "sale_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_orders" ADD CONSTRAINT "sale_orders_motorcycleUnitId_fkey" FOREIGN KEY ("motorcycleUnitId") REFERENCES "motorcycle_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
