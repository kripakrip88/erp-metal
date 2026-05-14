-- Cost engine fields for AssemblyCoating
-- costSnapshotPerKg: price snapshot at time of apply/create — never auto-updated from catalog
-- calculatedCost:    derived field (finalConsumptionKg * costSnapshotPerKg), not editable directly

ALTER TABLE "assembly_coatings"
    ADD COLUMN "costSnapshotPerKg" DECIMAL(12, 2),
    ADD COLUMN "calculatedCost"    DECIMAL(14, 2);
