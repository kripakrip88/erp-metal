-- CreateTable
CREATE TABLE "inventory_balances" (
    "id"                TEXT NOT NULL,
    "companyId"         TEXT NOT NULL,
    "materialId"        TEXT NOT NULL,
    "uom"               TEXT NOT NULL DEFAULT 'kg',
    "physicalQuantity"  DECIMAL(15,4) NOT NULL DEFAULT 0,
    "reservedQuantity"  DECIMAL(15,4) NOT NULL DEFAULT 0,
    "availableQuantity" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_balances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_balances_companyId_materialId_key"
    ON "inventory_balances"("companyId", "materialId");

-- CreateIndex
CREATE INDEX "inventory_balances_companyId_idx" ON "inventory_balances"("companyId");

-- CreateIndex
CREATE INDEX "inventory_balances_materialId_idx" ON "inventory_balances"("materialId");

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_materialId_fkey"
    FOREIGN KEY ("materialId") REFERENCES "coating_materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
