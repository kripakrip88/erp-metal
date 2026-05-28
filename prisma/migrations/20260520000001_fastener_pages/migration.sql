-- Safe migrations: only ADD COLUMN, no data loss

ALTER TABLE "material_categories" ADD COLUMN IF NOT EXISTS "domain" TEXT NOT NULL DEFAULT 'STRUCTURAL';
ALTER TABLE "material_definitions" ADD COLUMN IF NOT EXISTS "strengthClass" TEXT;
