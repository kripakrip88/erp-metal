-- =============================================================================
-- SECTION 5.3.3 — Revision Total Snapshots
-- Aggregated financial totals stored at freeze time.
-- Self-contained ERP snapshot: historical pricing, consumption, cost — immutable.
-- =============================================================================

ALTER TABLE "assembly_revisions"
    ADD COLUMN "totalTheoreticalConsumptionKg" DECIMAL(14,4),
    ADD COLUMN "totalFinalConsumptionKg"        DECIMAL(14,4),
    ADD COLUMN "totalCalculatedCost"            DECIMAL(16,2);

-- Domain constraints — totals are set only at freeze time; null = not yet frozen.
ALTER TABLE "assembly_revisions"
    ADD CONSTRAINT "ar_totalTheoreticalConsumptionKg_nonneg"
        CHECK ("totalTheoreticalConsumptionKg" IS NULL OR "totalTheoreticalConsumptionKg" >= 0),
    ADD CONSTRAINT "ar_totalFinalConsumptionKg_nonneg"
        CHECK ("totalFinalConsumptionKg" IS NULL OR "totalFinalConsumptionKg" >= 0),
    ADD CONSTRAINT "ar_totalCalculatedCost_nonneg"
        CHECK ("totalCalculatedCost" IS NULL OR "totalCalculatedCost" >= 0);
