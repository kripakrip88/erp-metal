-- Migration: add estimatedWeightKg/estimatedPaintAreaM2 to product_templates,
--            add sourceTemplateId/sourceTemplateVersion to assemblies
-- Run via SSH: npx prisma migrate deploy

ALTER TABLE "product_templates"
  ADD COLUMN "estimatedWeightKg"    DECIMAL(12,4);

ALTER TABLE "product_templates"
  ADD COLUMN "estimatedPaintAreaM2" DECIMAL(12,4);

ALTER TABLE "assemblies"
  ADD COLUMN "sourceTemplateId"      TEXT;

ALTER TABLE "assemblies"
  ADD COLUMN "sourceTemplateVersion" INTEGER;
