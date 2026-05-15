-- Consumption engine fields for AssemblyCoating
ALTER TABLE "assembly_coatings"
    ADD COLUMN "lossFactorPercent"        DECIMAL(5,2),
    ADD COLUMN "theoreticalConsumptionKg" DECIMAL(12,4),
    ADD COLUMN "finalConsumptionKg"       DECIMAL(12,4);
