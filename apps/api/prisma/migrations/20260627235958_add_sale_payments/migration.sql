-- CreateTable
CREATE TABLE "sale_payments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "saleOrderId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" VARCHAR(20) NOT NULL,
    "reference" VARCHAR(100),
    "notes" TEXT,
    "paidAt" TIMESTAMPTZ NOT NULL,
    "createdBy" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_sale_payments_order" ON "sale_payments"("saleOrderId");

-- AddForeignKey
ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_saleOrderId_fkey" FOREIGN KEY ("saleOrderId") REFERENCES "sale_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
