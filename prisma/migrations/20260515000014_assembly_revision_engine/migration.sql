-- =============================================================================
-- SECTION 5.3 — Assembly Revision Engine
-- Immutable ERP revision system for coating calculations and pricing snapshots
-- =============================================================================

-- AssemblyRevisionStatus enum
CREATE TYPE "AssemblyRevisionStatus" AS ENUM ('DRAFT', 'FROZEN', 'ARCHIVED');

-- ─── AssemblyRevision ────────────────────────────────────────────────────────

CREATE TABLE "assembly_revisions" (
    "id"                    TEXT         NOT NULL,
    "assemblyId"            TEXT         NOT NULL,
    "revisionNumber"        INTEGER      NOT NULL,
    "status"                "AssemblyRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdFromRevisionId" TEXT,
    "notes"                 TEXT,
    "frozenAt"              TIMESTAMP(3),
    "frozenByUserId"        TEXT,
    "freezeReason"          TEXT,
    "createdByUserId"       TEXT,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assembly_revisions_pkey"                            PRIMARY KEY ("id"),
    CONSTRAINT "assembly_revisions_assemblyId_revisionNumber_key"   UNIQUE ("assemblyId", "revisionNumber")
);

ALTER TABLE "assembly_revisions"
    ADD CONSTRAINT "ar_assemblyId_fkey"
        FOREIGN KEY ("assemblyId") REFERENCES "assemblies"("id") ON DELETE CASCADE,
    ADD CONSTRAINT "ar_createdFromRevisionId_fkey"
        FOREIGN KEY ("createdFromRevisionId") REFERENCES "assembly_revisions"("id") ON DELETE SET NULL;

CREATE INDEX "ar_assemblyId_status_idx"        ON "assembly_revisions"("assemblyId", "status");
CREATE INDEX "ar_assemblyId_revisionNumber_idx" ON "assembly_revisions"("assemblyId", "revisionNumber");

-- Domain constraints
ALTER TABLE "assembly_revisions"
    ADD CONSTRAINT "ar_revisionNumber_positive"
        CHECK ("revisionNumber" > 0);

-- ─── AssemblyRevisionCoatingSnapshot ─────────────────────────────────────────

CREATE TABLE "assembly_revision_coating_snapshots" (
    "id"                        TEXT         NOT NULL,
    "assemblyRevisionId"        TEXT         NOT NULL,
    "assemblyId"                TEXT         NOT NULL,
    "coatingMaterialId"         TEXT,
    "materialCodeSnapshot"      TEXT         NOT NULL,
    "materialNameSnapshot"      TEXT         NOT NULL,
    "layerNumber"               INTEGER      NOT NULL,
    "position"                  INTEGER      NOT NULL DEFAULT 0,
    "selectedDftMkm"            INTEGER,
    "dilutionPercent"           DECIMAL(5,2),
    "lossFactorPercent"         DECIMAL(5,2),
    "theoreticalConsumptionKg"  DECIMAL(12,4),
    "finalConsumptionKg"        DECIMAL(12,4),
    "costSnapshotPerKg"         DECIMAL(12,2),
    "calculatedCost"            DECIMAL(14,2),
    "calculationFormulaVersion" TEXT,
    "pricingFormulaVersion"     TEXT,
    "createdAt"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arcs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "assembly_revision_coating_snapshots"
    ADD CONSTRAINT "arcs_assemblyRevisionId_fkey"
        FOREIGN KEY ("assemblyRevisionId") REFERENCES "assembly_revisions"("id") ON DELETE CASCADE;

CREATE INDEX "arcs_assemblyRevisionId_idx" ON "assembly_revision_coating_snapshots"("assemblyRevisionId");
CREATE INDEX "arcs_assemblyId_idx"         ON "assembly_revision_coating_snapshots"("assemblyId");

-- Domain constraints
ALTER TABLE "assembly_revision_coating_snapshots"
    ADD CONSTRAINT "arcs_layerNumber_positive"
        CHECK ("layerNumber" > 0),
    ADD CONSTRAINT "arcs_position_nonneg"
        CHECK ("position" >= 0),
    ADD CONSTRAINT "arcs_theoreticalConsumptionKg_nonneg"
        CHECK ("theoreticalConsumptionKg" IS NULL OR "theoreticalConsumptionKg" >= 0),
    ADD CONSTRAINT "arcs_finalConsumptionKg_nonneg"
        CHECK ("finalConsumptionKg" IS NULL OR "finalConsumptionKg" >= 0),
    ADD CONSTRAINT "arcs_costSnapshotPerKg_positive"
        CHECK ("costSnapshotPerKg" IS NULL OR "costSnapshotPerKg" > 0),
    ADD CONSTRAINT "arcs_calculatedCost_nonneg"
        CHECK ("calculatedCost" IS NULL OR "calculatedCost" >= 0);
