-- Migration: add qty column to assemblies
-- Run via SSH: npx prisma migrate deploy

ALTER TABLE "assemblies" ADD COLUMN "qty" INTEGER NOT NULL DEFAULT 1;
