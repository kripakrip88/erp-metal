-- Migration: add unitWeightKg to material_geometries, pieceUnit to material_definitions
-- Run via SSH: npx prisma migrate deploy

ALTER TABLE "material_geometries"
  ADD COLUMN "unitWeightKg" DECIMAL(12,4);

ALTER TABLE "material_definitions"
  ADD COLUMN "pieceUnit" TEXT DEFAULT 'pcs';
