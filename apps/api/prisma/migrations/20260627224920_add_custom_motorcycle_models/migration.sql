-- CreateTable
CREATE TABLE "custom_motorcycle_models" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brand" VARCHAR(100) NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "yearFrom" SMALLINT NOT NULL,
    "yearTo" SMALLINT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_motorcycle_models_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_custom_moto_models" ON "custom_motorcycle_models"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "custom_motorcycle_models_tenantId_brand_model_key" ON "custom_motorcycle_models"("tenantId", "brand", "model");

-- AddForeignKey
ALTER TABLE "custom_motorcycle_models" ADD CONSTRAINT "custom_motorcycle_models_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
