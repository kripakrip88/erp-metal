-- =============================================================================
-- SECTION 5.3.8 RF-2 — Partial unique index: one DRAFT per assembly
-- Enforces DB-level uniqueness so concurrent createDraftRevision calls cannot
-- both succeed even if the application-level check races between them.
-- Partial index (WHERE status = 'DRAFT') allows multiple FROZEN/ARCHIVED rows
-- for the same assembly — only the DRAFT slot is restricted to one at a time.
-- =============================================================================

CREATE UNIQUE INDEX "ar_one_draft_per_assembly"
    ON "assembly_revisions"("assemblyId")
    WHERE "status" = 'DRAFT';
