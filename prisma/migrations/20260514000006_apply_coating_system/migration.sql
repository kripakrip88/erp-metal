-- AddColumns: snapshot fields for immutable material identity at creation time
ALTER TABLE "assembly_coatings"
    ADD COLUMN "materialCodeSnapshot" TEXT,
    ADD COLUMN "materialNameSnapshot" TEXT;

-- CreateIndex: assemblyId for fast per-assembly queries
CREATE INDEX "assembly_coatings_assemblyId_idx" ON "assembly_coatings"("assemblyId");

-- CreateIndex: coatingSystemId for traceability/audit queries
CREATE INDEX "assembly_coatings_coatingSystemId_idx" ON "assembly_coatings"("coatingSystemId");
