-- Rename: selectedDftMkm → defaultDftMkm (template semantics, not runtime)
ALTER TABLE "coating_system_layers"
    RENAME COLUMN "selectedDftMkm" TO "defaultDftMkm";

-- Rename: dilutionPercent → defaultDilutionPercent (template semantics)
ALTER TABLE "coating_system_layers"
    RENAME COLUMN "dilutionPercent" TO "defaultDilutionPercent";

-- Drop old non-unique index (replaced by unique constraint below)
DROP INDEX IF EXISTS "coating_system_layers_coatingSystemId_position_idx";

-- AddUniqueConstraint: one position per system (guarantees stable order)
ALTER TABLE "coating_system_layers"
    ADD CONSTRAINT "coating_system_layers_coatingSystemId_position_key"
    UNIQUE ("coatingSystemId", "position");
