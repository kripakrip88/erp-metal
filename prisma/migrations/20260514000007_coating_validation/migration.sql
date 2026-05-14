-- =============================================================================
-- Domain validation constraints for coating subsystem
-- Three tables: assembly_coatings, coating_system_layers, coating_systems
-- =============================================================================

-- assembly_coatings
ALTER TABLE "assembly_coatings"
    ADD CONSTRAINT "ac_layerNumber_positive"
        CHECK ("layerNumber" > 0),
    ADD CONSTRAINT "ac_position_nonneg"
        CHECK ("position" >= 0),
    ADD CONSTRAINT "ac_selectedDftMkm_positive"
        CHECK ("selectedDftMkm" IS NULL OR "selectedDftMkm" > 0),
    ADD CONSTRAINT "ac_dilutionPercent_range"
        CHECK ("dilutionPercent" IS NULL OR ("dilutionPercent" >= 0 AND "dilutionPercent" <= 100));

-- coating_system_layers
ALTER TABLE "coating_system_layers"
    ADD CONSTRAINT "csl_layerNumber_positive"
        CHECK ("layerNumber" > 0),
    ADD CONSTRAINT "csl_position_nonneg"
        CHECK ("position" >= 0),
    ADD CONSTRAINT "csl_defaultDftMkm_positive"
        CHECK ("defaultDftMkm" IS NULL OR "defaultDftMkm" > 0),
    ADD CONSTRAINT "csl_defaultDilutionPercent_range"
        CHECK ("defaultDilutionPercent" IS NULL OR ("defaultDilutionPercent" >= 0 AND "defaultDilutionPercent" <= 100));

-- coating_systems
ALTER TABLE "coating_systems"
    ADD CONSTRAINT "cs_position_nonneg"
        CHECK ("position" >= 0);

-- coating_materials (physical properties must be positive)
ALTER TABLE "coating_materials"
    ADD CONSTRAINT "cm_consumptionGm2_positive"
        CHECK ("consumptionGm2" > 0),
    ADD CONSTRAINT "cm_referenceDftMkm_positive"
        CHECK ("referenceDftMkm" > 0),
    ADD CONSTRAINT "cm_densityKgL_positive"
        CHECK ("densityKgL" > 0),
    ADD CONSTRAINT "cm_recommendedDilutionPercent_range"
        CHECK ("recommendedDilutionPercent" IS NULL OR ("recommendedDilutionPercent" >= 0 AND "recommendedDilutionPercent" <= 100)),
    ADD CONSTRAINT "cm_pricePerKg_positive"
        CHECK ("pricePerKg" IS NULL OR "pricePerKg" > 0);
