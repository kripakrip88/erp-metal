-- Add partCategory and stableUid to parts table
ALTER TABLE "parts"
    ADD COLUMN "partCategory" TEXT NOT NULL DEFAULT 'MATERIAL',
    ADD COLUMN "stableUid"    TEXT NOT NULL DEFAULT gen_random_uuid()::text;

CREATE INDEX "parts_partCategory_idx" ON "parts"("partCategory");
