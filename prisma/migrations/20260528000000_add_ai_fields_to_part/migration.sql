-- AI Normalization fields for Part
-- Makes materialDefinitionId nullable (AI parts may have no match)
-- Adds default to measurementType (AI parts default to LINEAR)
-- Adds aiGenerated, aiRawText, aiNormResultId, aiConfidence, aiMatchMethod, aiStatus

ALTER TABLE "parts" ALTER COLUMN "materialDefinitionId" DROP NOT NULL;
ALTER TABLE "parts" ALTER COLUMN "measurementType" SET DEFAULT 'LINEAR'::"MeasurementType";

ALTER TABLE "parts" ADD COLUMN IF NOT EXISTS "aiGenerated"    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "parts" ADD COLUMN IF NOT EXISTS "aiRawText"      TEXT;
ALTER TABLE "parts" ADD COLUMN IF NOT EXISTS "aiNormResultId" TEXT;
ALTER TABLE "parts" ADD COLUMN IF NOT EXISTS "aiConfidence"   DOUBLE PRECISION;
ALTER TABLE "parts" ADD COLUMN IF NOT EXISTS "aiMatchMethod"  TEXT;
ALTER TABLE "parts" ADD COLUMN IF NOT EXISTS "aiStatus"       TEXT;

CREATE INDEX IF NOT EXISTS "parts_aiGenerated_idx" ON "parts"("aiGenerated");
