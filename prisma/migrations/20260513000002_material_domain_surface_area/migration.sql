-- Migration: add materialDomain to material_definitions, surfaceAreaM2 to parts
-- Run via SSH: npx prisma migrate deploy

CREATE TYPE "MaterialDomain" AS ENUM ('STRUCTURAL', 'FASTENER', 'COATING', 'CONSUMABLE');

ALTER TABLE "material_definitions"
  ADD COLUMN "materialDomain" "MaterialDomain" NOT NULL DEFAULT 'STRUCTURAL';

ALTER TABLE "parts"
  ADD COLUMN "surfaceAreaM2" DECIMAL(12,4);
