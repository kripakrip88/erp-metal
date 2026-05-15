-- AddColumns: CoatingSystem business metadata
ALTER TABLE "coating_systems"
    ADD COLUMN "description" TEXT,
    ADD COLUMN "isActive"    BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "position"    INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "uiColor"     TEXT;

-- CreateIndex
CREATE INDEX "coating_systems_companyId_isActive_idx" ON "coating_systems"("companyId", "isActive");
CREATE INDEX "coating_systems_companyId_position_idx" ON "coating_systems"("companyId", "position");
