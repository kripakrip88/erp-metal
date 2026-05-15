-- =============================================================================
-- SECTION 5.4.5 — Quote / Revision Traceability Hardening
-- Adds provenance metadata to QuoteRevision so every commercial snapshot
-- can be traced back to the exact frozen engineering revision it was built from.
-- =============================================================================

-- Fast lookup of which released revision each assembly contributed to a quote.
-- Avoids joining through RevisionAssemblyCoating for provenance queries.
ALTER TABLE "quote_revisions"
    ADD COLUMN "sourceReleasedRevisionIds" JSONB;

-- ─── Index ────────────────────────────────────────────────────────────────────

-- Supports listing quotes by status within an order (e.g. finding active/superseded).
CREATE INDEX "quote_revisions_orderId_status_idx"
    ON "quote_revisions"("orderId", "status");
