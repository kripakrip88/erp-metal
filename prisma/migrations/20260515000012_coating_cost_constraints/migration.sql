-- CHECK constraints for cost engine fields on assembly_coatings
-- costSnapshotPerKg > 0: price must be positive if set (null = no price snapshot yet)
-- calculatedCost >= 0: derived monetary value, cannot be negative

ALTER TABLE "assembly_coatings"
    ADD CONSTRAINT "ac_costSnapshotPerKg_positive"
        CHECK ("costSnapshotPerKg" IS NULL OR "costSnapshotPerKg" > 0),
    ADD CONSTRAINT "ac_calculatedCost_nonneg"
        CHECK ("calculatedCost" IS NULL OR "calculatedCost" >= 0);
