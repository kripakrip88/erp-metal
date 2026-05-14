-- XOR invariant: autoAreaLink and manualAreaM2 must be consistent.
-- autoAreaLink=true  → manualAreaM2 must be NULL  (area comes from assembly parts)
-- autoAreaLink=false → manualAreaM2 must NOT be NULL (area is manually specified)
-- Mixed states create ambiguous area source and must be rejected at DB level.

ALTER TABLE "assembly_coatings"
    ADD CONSTRAINT "ac_area_source_xor"
        CHECK (
            ("autoAreaLink" = true  AND "manualAreaM2" IS NULL) OR
            ("autoAreaLink" = false AND "manualAreaM2" IS NOT NULL)
        );
