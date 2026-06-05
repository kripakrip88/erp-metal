-- Event log for in-process event bus: audit trail of all emitted domain events

CREATE TABLE "event_logs" (
    "id"            TEXT        NOT NULL,
    "correlationId" TEXT        NOT NULL,
    "eventType"     TEXT        NOT NULL,
    "source"        TEXT        NOT NULL,
    "payload"       JSONB       NOT NULL,
    "status"        TEXT        NOT NULL DEFAULT 'PENDING',
    "error"         TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt"   TIMESTAMP(3),
    CONSTRAINT "event_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "event_logs_correlationId_idx" ON "event_logs"("correlationId");
CREATE INDEX "event_logs_eventType_idx"     ON "event_logs"("eventType");
CREATE INDEX "event_logs_status_idx"        ON "event_logs"("status");
