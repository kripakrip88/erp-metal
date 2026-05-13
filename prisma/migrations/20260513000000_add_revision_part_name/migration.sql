-- Migration: add name column to revision_parts
-- Run via SSH: npx prisma migrate deploy

ALTER TABLE "revision_parts" ADD COLUMN "name" TEXT;
