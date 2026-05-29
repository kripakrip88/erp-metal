-- Fastener-specific attributes on material_definitions
ALTER TABLE "material_definitions" ADD COLUMN IF NOT EXISTS "gost"           TEXT;
ALTER TABLE "material_definitions" ADD COLUMN IF NOT EXISTS "fastenerType"   TEXT;
ALTER TABLE "material_definitions" ADD COLUMN IF NOT EXISTS "diameterMm"     DECIMAL(10,2);
ALTER TABLE "material_definitions" ADD COLUMN IF NOT EXISTS "lengthMm"       DECIMAL(10,2);
ALTER TABLE "material_definitions" ADD COLUMN IF NOT EXISTS "threadType"     TEXT;
ALTER TABLE "material_definitions" ADD COLUMN IF NOT EXISTS "coating"        TEXT;
ALTER TABLE "material_definitions" ADD COLUMN IF NOT EXISTS "weightRequired" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "material_definitions" ADD COLUMN IF NOT EXISTS "weightNote"     TEXT;
