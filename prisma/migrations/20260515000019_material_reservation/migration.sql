-- CreateEnum
CREATE TYPE "ReservationType" AS ENUM ('PROCUREMENT', 'PRODUCTION', 'MANUAL');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('RESERVED', 'RELEASED', 'CANCELLED');

-- CreateTable
CREATE TABLE "material_reservations" (
    "id"                  TEXT NOT NULL,
    "companyId"           TEXT NOT NULL,
    "orderId"             TEXT NOT NULL,
    "assemblyRevisionId"  TEXT NOT NULL,
    "materialId"          TEXT NOT NULL,
    "coatingSnapshotId"   TEXT,
    "reservationType"     "ReservationType" NOT NULL DEFAULT 'PROCUREMENT',
    "status"              "ReservationStatus" NOT NULL DEFAULT 'RESERVED',
    "reservedQuantity"    DECIMAL(12,4) NOT NULL,
    "unit"                TEXT NOT NULL DEFAULT 'kg',
    "notes"               TEXT,
    "reservedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt"          TIMESTAMP(3),
    "cancelledAt"         TIMESTAMP(3),
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "material_reservations_companyId_assemblyRevisionId_materialId_coatingSnapshotId_key"
    ON "material_reservations"("companyId", "assemblyRevisionId", "materialId", "coatingSnapshotId");

-- CreateIndex
CREATE INDEX "material_reservations_orderId_idx" ON "material_reservations"("orderId");

-- CreateIndex
CREATE INDEX "material_reservations_assemblyRevisionId_idx" ON "material_reservations"("assemblyRevisionId");

-- CreateIndex
CREATE INDEX "material_reservations_materialId_idx" ON "material_reservations"("materialId");

-- CreateIndex
CREATE INDEX "material_reservations_status_idx" ON "material_reservations"("status");

-- AddForeignKey
ALTER TABLE "material_reservations" ADD CONSTRAINT "material_reservations_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_reservations" ADD CONSTRAINT "material_reservations_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_reservations" ADD CONSTRAINT "material_reservations_assemblyRevisionId_fkey"
    FOREIGN KEY ("assemblyRevisionId") REFERENCES "assembly_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_reservations" ADD CONSTRAINT "material_reservations_materialId_fkey"
    FOREIGN KEY ("materialId") REFERENCES "coating_materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_reservations" ADD CONSTRAINT "material_reservations_coatingSnapshotId_fkey"
    FOREIGN KEY ("coatingSnapshotId") REFERENCES "assembly_revision_coating_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
