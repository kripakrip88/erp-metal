-- Migration: add material_categories + categoryId on material_definitions
-- Run via SSH: npx prisma migrate deploy

CREATE TABLE "material_categories" (
  "id"        TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "companyId" TEXT NOT NULL,
  "slug"      TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "parentId"  TEXT,
  "position"  INTEGER NOT NULL DEFAULT 0,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deletedAt" TIMESTAMPTZ,

  CONSTRAINT "material_categories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "material_categories_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id"),
  CONSTRAINT "material_categories_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "material_categories"("id")
);

CREATE UNIQUE INDEX "material_categories_companyId_slug_key"
  ON "material_categories"("companyId", "slug");

-- Add categoryId to material_definitions
ALTER TABLE "material_definitions"
  ADD COLUMN "categoryId" TEXT;

ALTER TABLE "material_definitions"
  ADD CONSTRAINT "material_definitions_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "material_categories"("id");

-- Seed default categories and backfill categoryId
DO $$
DECLARE
  cid TEXT;
BEGIN
  SELECT id INTO cid FROM companies LIMIT 1;

  IF cid IS NOT NULL THEN
    INSERT INTO "material_categories" ("companyId", "slug", "name", "position")
    VALUES
      (cid, 'tube_sq',  'Труба профильная',  1),
      (cid, 'tube_rnd', 'Труба круглая',     2),
      (cid, 'angle',    'Уголок',            3),
      (cid, 'channel',  'Швеллер / Балка',   4),
      (cid, 'sheet',    'Лист / Плита',      5),
      (cid, 'rebar',    'Пруток / Арматура', 6),
      (cid, 'piece',    'Штучный товар',     7)
    ON CONFLICT ("companyId", "slug") DO NOTHING;

    UPDATE "material_definitions" md
    SET "categoryId" = mc.id
    FROM "material_categories" mc
    WHERE mc."companyId" = md."companyId"
      AND mc."slug" = CASE md."profileType"
        WHEN 'RECTANGULAR_TUBE' THEN 'tube_sq'
        WHEN 'ROUND_TUBE'       THEN 'tube_rnd'
        WHEN 'ANGLE'            THEN 'angle'
        WHEN 'CHANNEL'          THEN 'channel'
        WHEN 'BEAM'             THEN 'channel'
        WHEN 'SHEET'            THEN 'sheet'
        WHEN 'PLATE'            THEN 'sheet'
        WHEN 'FLAT_BAR'         THEN 'rebar'
        WHEN 'ROUND_BAR'        THEN 'rebar'
        ELSE 'piece'
      END;
  END IF;
END $$;
