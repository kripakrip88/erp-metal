-- Migration: create product_templates, product_template_nodes, product_template_node_parts
-- Run via SSH: npx prisma migrate deploy

CREATE TABLE "product_templates" (
  "id"          TEXT         NOT NULL,
  "companyId"   TEXT         NOT NULL,
  "code"        TEXT         NOT NULL,
  "name"        TEXT         NOT NULL,
  "description" TEXT,
  "isActive"    BOOLEAN      NOT NULL DEFAULT true,
  "version"     INTEGER      NOT NULL DEFAULT 1,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  "deletedAt"   TIMESTAMP(3),

  CONSTRAINT "product_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_templates_companyId_code_key"
  ON "product_templates"("companyId", "code");

ALTER TABLE "product_templates"
  ADD CONSTRAINT "product_templates_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- MAX_DEPTH=3 enforced at application level
CREATE TABLE "product_template_nodes" (
  "id"           TEXT         NOT NULL,
  "templateId"   TEXT         NOT NULL,
  "parentNodeId" TEXT,
  "name"         TEXT         NOT NULL,
  "qty"          INTEGER      NOT NULL DEFAULT 1,
  "position"     INTEGER      NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT "product_template_nodes_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "product_template_nodes"
  ADD CONSTRAINT "product_template_nodes_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "product_templates"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_template_nodes"
  ADD CONSTRAINT "product_template_nodes_parentNodeId_fkey"
  FOREIGN KEY ("parentNodeId") REFERENCES "product_template_nodes"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "product_template_node_parts" (
  "id"                   TEXT              NOT NULL,
  "nodeId"               TEXT              NOT NULL,
  "materialDefinitionId" TEXT              NOT NULL,
  "measurementType"      "MeasurementType" NOT NULL,
  "length"               DECIMAL(12,4),
  "sheetWidth"           DECIMAL(12,4),
  "sheetHeight"          DECIMAL(12,4),
  "directWeightKg"       DECIMAL(12,4),
  "surfaceAreaM2"        DECIMAL(12,4),
  "quantity"             INTEGER           NOT NULL,
  "notes"                TEXT,
  "position"             INTEGER           NOT NULL DEFAULT 0,

  CONSTRAINT "product_template_node_parts_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "product_template_node_parts"
  ADD CONSTRAINT "product_template_node_parts_nodeId_fkey"
  FOREIGN KEY ("nodeId") REFERENCES "product_template_nodes"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_template_node_parts"
  ADD CONSTRAINT "product_template_node_parts_materialDefinitionId_fkey"
  FOREIGN KEY ("materialDefinitionId") REFERENCES "material_definitions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
