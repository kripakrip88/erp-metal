-- Migration: piece pricing and snapshot fields
-- Run via SSH: npx prisma migrate deploy

-- ProcurementProfile: price per piece (штучные изделия)
ALTER TABLE "procurement_profiles"
  ADD COLUMN "pricePerPiece" DECIMAL(14,4);

-- RevisionPart: audit fields for PIECE type and assembly multiplier
ALTER TABLE "revision_parts"
  ADD COLUMN "directWeightKg" DECIMAL(12,4),
  ADD COLUMN "assemblyQty"    INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "pricePerPiece"  DECIMAL(14,4);
