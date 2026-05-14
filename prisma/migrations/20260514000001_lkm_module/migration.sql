-- CreateEnum
CREATE TYPE "CoatingType" AS ENUM ('PRIMER', 'BASE_COAT', 'TOPCOAT', 'CLEAR', 'OTHER');

-- CreateTable: coating_materials
CREATE TABLE "coating_materials" (
    "id"                         TEXT NOT NULL,
    "companyId"                  TEXT NOT NULL,
    "code"                       TEXT NOT NULL,
    "name"                       TEXT NOT NULL,
    "coatingType"                "CoatingType" NOT NULL,
    "consumptionGm2"             DECIMAL(10,4) NOT NULL,
    "referenceDftMkm"            INTEGER NOT NULL,
    "densityKgL"                 DECIMAL(8,4) NOT NULL,
    "recommendedDilutionPercent" DECIMAL(5,2),
    "pricePerKg"                 DECIMAL(12,2),
    "supplierName"               TEXT,
    "notes"                      TEXT,
    "isActive"                   BOOLEAN NOT NULL DEFAULT true,
    "createdAt"                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "coating_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable: assembly_coatings
CREATE TABLE "assembly_coatings" (
    "id"                TEXT NOT NULL,
    "assemblyId"        TEXT NOT NULL,
    "coatingMaterialId" TEXT NOT NULL,
    "layerNumber"       INTEGER NOT NULL DEFAULT 1,
    "autoAreaLink"      BOOLEAN NOT NULL DEFAULT true,
    "manualAreaM2"      DECIMAL(12,4),
    "selectedDftMkm"    INTEGER,
    "dilutionPercent"   DECIMAL(5,2),
    "notes"             TEXT,
    "position"          INTEGER NOT NULL DEFAULT 0,
    "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "assembly_coatings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: revision_assembly_coatings
CREATE TABLE "revision_assembly_coatings" (
    "id"              TEXT NOT NULL,
    "revisionId"      TEXT NOT NULL,
    "assemblyId"      TEXT NOT NULL,
    "assemblyName"    TEXT NOT NULL,
    "coatingCode"     TEXT NOT NULL,
    "coatingName"     TEXT NOT NULL,
    "coatingType"     TEXT NOT NULL,
    "layerNumber"     INTEGER NOT NULL,
    "position"        INTEGER NOT NULL DEFAULT 0,
    "areaM2"          DECIMAL(12,4) NOT NULL,
    "consumptionKg"   DECIMAL(12,4) NOT NULL,
    "consumptionL"    DECIMAL(12,4),
    "totalKg"         DECIMAL(12,4) NOT NULL,
    "selectedDftMkm"  INTEGER NOT NULL,
    "dilutionPercent" DECIMAL(5,2) NOT NULL,
    "pricePerKg"      DECIMAL(12,2),
    "totalCost"       DECIMAL(14,2),

    CONSTRAINT "revision_assembly_coatings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "coating_materials"
    ADD CONSTRAINT "coating_materials_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddUniqueConstraint
ALTER TABLE "coating_materials"
    ADD CONSTRAINT "coating_materials_companyId_code_key" UNIQUE ("companyId", "code");

-- AddForeignKey
ALTER TABLE "assembly_coatings"
    ADD CONSTRAINT "assembly_coatings_assemblyId_fkey"
    FOREIGN KEY ("assemblyId") REFERENCES "assemblies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assembly_coatings"
    ADD CONSTRAINT "assembly_coatings_coatingMaterialId_fkey"
    FOREIGN KEY ("coatingMaterialId") REFERENCES "coating_materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_assembly_coatings"
    ADD CONSTRAINT "revision_assembly_coatings_revisionId_fkey"
    FOREIGN KEY ("revisionId") REFERENCES "quote_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
