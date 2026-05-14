-- CHECK constraints for consumption engine fields on assembly_coatings
-- manualAreaM2 > 0: null means autoAreaLink is active; explicit 0 is forbidden (no-paint state must not be saved)
-- lossFactorPercent in [0, 100]: percentage, null = 0%
-- theoreticalConsumptionKg >= 0: physical quantity
-- finalConsumptionKg >= 0: physical quantity

ALTER TABLE "assembly_coatings"
    ADD CONSTRAINT "ac_manualAreaM2_positive"
        CHECK ("manualAreaM2" IS NULL OR "manualAreaM2" > 0),
    ADD CONSTRAINT "ac_lossFactorPercent_range"
        CHECK ("lossFactorPercent" IS NULL OR ("lossFactorPercent" >= 0 AND "lossFactorPercent" <= 100)),
    ADD CONSTRAINT "ac_theoreticalConsumptionKg_nonneg"
        CHECK ("theoreticalConsumptionKg" IS NULL OR "theoreticalConsumptionKg" >= 0),
    ADD CONSTRAINT "ac_finalConsumptionKg_nonneg"
        CHECK ("finalConsumptionKg" IS NULL OR "finalConsumptionKg" >= 0);
