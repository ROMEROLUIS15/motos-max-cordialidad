-- CreateTable
CREATE TABLE "motorcycle_units" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "vin" VARCHAR(50) NOT NULL,
    "brand" VARCHAR(100) NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "year" SMALLINT NOT NULL,
    "displacement" SMALLINT,
    "color" VARCHAR(50),
    "condition" VARCHAR(10) NOT NULL DEFAULT 'NEW',
    "mileage" INTEGER NOT NULL DEFAULT 0,
    "engineNumber" VARCHAR(50),
    "plate" VARCHAR(20),
    "costPrice" DECIMAL(12,2) NOT NULL,
    "salePrice" DECIMAL(12,2) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    "description" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "motorcycle_units_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_moto_units_status" ON "motorcycle_units"("tenantId", "status");

-- CreateIndex
CREATE INDEX "idx_moto_units_branch" ON "motorcycle_units"("branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "motorcycle_units_tenantId_vin_key" ON "motorcycle_units"("tenantId", "vin");

-- AddForeignKey
ALTER TABLE "motorcycle_units" ADD CONSTRAINT "motorcycle_units_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "motorcycle_units" ADD CONSTRAINT "motorcycle_units_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
