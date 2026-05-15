-- BOM visual tree metadata
-- 6 fields added to Part (live data) and RevisionPart (snapshot)

ALTER TABLE "parts"
  ADD COLUMN "bomTemplateCode"    TEXT,
  ADD COLUMN "bomGroupKey"        TEXT,
  ADD COLUMN "bomGroupLabel"      TEXT,
  ADD COLUMN "bomDepth"           INTEGER,
  ADD COLUMN "bomPath"            JSONB,
  ADD COLUMN "bomSortPath"        TEXT,
  ADD COLUMN "bomTemplateId"      TEXT,
  ADD COLUMN "bomTemplateVersion" INTEGER;

ALTER TABLE "revision_parts"
  ADD COLUMN "bomTemplateCode"    TEXT,
  ADD COLUMN "bomGroupKey"        TEXT,
  ADD COLUMN "bomGroupLabel"      TEXT,
  ADD COLUMN "bomDepth"           INTEGER,
  ADD COLUMN "bomPath"            JSONB,
  ADD COLUMN "bomSortPath"        TEXT,
  ADD COLUMN "bomTemplateId"      TEXT,
  ADD COLUMN "bomTemplateVersion" INTEGER;
