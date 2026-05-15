-- =============================================================================
-- SECTION 5.4.2 — Revision Release Foundation
-- Adds revision lifecycle pointers to Assembly and Order, and a traceability
-- FK from RevisionAssemblyCoating back to the engineering AssemblyRevision.
-- =============================================================================

-- ─── Column additions ─────────────────────────────────────────────────────────

ALTER TABLE "assemblies"
    ADD COLUMN "currentRevisionId"   TEXT,
    ADD COLUMN "releasedRevisionId"  TEXT;

ALTER TABLE "orders"
    ADD COLUMN "activeQuoteRevisionId" TEXT;

ALTER TABLE "revision_assembly_coatings"
    ADD COLUMN "assemblyRevisionId" TEXT;

-- ─── Foreign keys ─────────────────────────────────────────────────────────────

-- Assembly.currentRevisionId → AssemblyRevision
-- SetNull: deleting a DRAFT revision clears the workspace pointer; assembly survives.
ALTER TABLE "assemblies"
    ADD CONSTRAINT "assemblies_currentRevisionId_fkey"
        FOREIGN KEY ("currentRevisionId")
        REFERENCES "assembly_revisions"("id")
        ON DELETE SET NULL;

-- Assembly.releasedRevisionId → AssemblyRevision
-- Restrict: the production anchor revision MUST NOT be deleted while it is
-- still pinned. Force the caller to clear releasedRevisionId first.
ALTER TABLE "assemblies"
    ADD CONSTRAINT "assemblies_releasedRevisionId_fkey"
        FOREIGN KEY ("releasedRevisionId")
        REFERENCES "assembly_revisions"("id")
        ON DELETE RESTRICT;

-- Order.activeQuoteRevisionId → QuoteRevision
-- SetNull: deleting a quote revision clears the active-quote pointer; order survives.
ALTER TABLE "orders"
    ADD CONSTRAINT "orders_activeQuoteRevisionId_fkey"
        FOREIGN KEY ("activeQuoteRevisionId")
        REFERENCES "quote_revisions"("id")
        ON DELETE SET NULL;

-- RevisionAssemblyCoating.assemblyRevisionId → AssemblyRevision
-- SetNull: traceability link only — coating snapshot data remains valid commercially
-- even if the source engineering revision is later deleted.
ALTER TABLE "revision_assembly_coatings"
    ADD CONSTRAINT "revision_assembly_coatings_assemblyRevisionId_fkey"
        FOREIGN KEY ("assemblyRevisionId")
        REFERENCES "assembly_revisions"("id")
        ON DELETE SET NULL;

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX "assemblies_currentRevisionId_idx"
    ON "assemblies"("currentRevisionId");

CREATE INDEX "assemblies_releasedRevisionId_idx"
    ON "assemblies"("releasedRevisionId");

CREATE INDEX "orders_activeQuoteRevisionId_idx"
    ON "orders"("activeQuoteRevisionId");

CREATE INDEX "revision_assembly_coatings_assemblyRevisionId_idx"
    ON "revision_assembly_coatings"("assemblyRevisionId");
