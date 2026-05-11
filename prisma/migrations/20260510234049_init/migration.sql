-- CreateEnum
CREATE TYPE "MaterialType" AS ENUM ('STEEL', 'STAINLESS', 'ALUMINUM', 'GALVANIZED');

-- CreateEnum
CREATE TYPE "ProfileType" AS ENUM ('RECTANGULAR_TUBE', 'ROUND_TUBE', 'ANGLE', 'CHANNEL', 'BEAM', 'SHEET', 'PLATE', 'FLAT_BAR', 'ROUND_BAR');

-- CreateEnum
CREATE TYPE "CurrencyCode" AS ENUM ('RUB', 'USD', 'EUR');

-- CreateEnum
CREATE TYPE "PurchaseUnit" AS ENUM ('METER', 'TON', 'SHEET', 'PIECE', 'SQUARE_METER');

-- CreateEnum
CREATE TYPE "MeasurementType" AS ENUM ('LINEAR', 'AREA', 'PIECE');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'QUOTATION', 'AWAITING_APPROVAL', 'APPROVED', 'PRODUCTION', 'COMPLETED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderMode" AS ENUM ('STANDARD', 'PHASED');

-- CreateEnum
CREATE TYPE "PhaseStatus" AS ENUM ('PLANNED', 'IN_PRODUCTION', 'READY', 'SHIPPED');

-- CreateEnum
CREATE TYPE "RevisionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'ENGINEER', 'VIEWER');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'ARCHIVE', 'RESTORE', 'STATUS_CHANGE', 'PRICE_UPDATE', 'REVISION_SNAPSHOT');

-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('PDF', 'DWG', 'DXF', 'STEP', 'IMAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "CostCategory" AS ENUM ('MATERIAL', 'CUTTING', 'WELDING', 'BENDING', 'PAINTING', 'GALVANIZING', 'OUTSOURCING', 'DELIVERY', 'OVERHEAD', 'MARGIN', 'DISCOUNT', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkCenterType" AS ENUM ('LASER', 'BANDSAW', 'LATHE', 'WELDING', 'BENDING', 'OTHER');

-- CreateEnum
CREATE TYPE "OperationType" AS ENUM ('CUT', 'BEND', 'WELD', 'DRILL', 'PAINT', 'ASSEMBLE', 'OTHER');

-- CreateEnum
CREATE TYPE "StepStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE', 'SKIPPED');

-- CreateEnum
CREATE TYPE "SteelGrade" AS ENUM ('S235', 'S245', 'S345', 'S355', 'S09G2S', 'AISI304', 'AISI316', 'OTHER');

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "taxId" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_definitions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "materialType" "MaterialType" NOT NULL,
    "profileType" "ProfileType" NOT NULL,
    "steelGrade" "SteelGrade",
    "geometryId" TEXT NOT NULL,
    "description" TEXT,
    "standard" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "material_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_geometries" (
    "id" TEXT NOT NULL,
    "width" DECIMAL(12,4),
    "height" DECIMAL(12,4),
    "thickness" DECIMAL(12,4),
    "diameter" DECIMAL(12,4),
    "innerDiameter" DECIMAL(12,4),
    "sheetWidth" DECIMAL(12,4),
    "sheetLength" DECIMAL(12,4),
    "measurementType" "MeasurementType" NOT NULL,
    "theoreticalWeightPerMeter" DECIMAL(12,6),
    "actualWeightPerMeter" DECIMAL(12,6),
    "weightPerSquareMeter" DECIMAL(12,6),
    "paintSurfacePerMeter" DECIMAL(12,6),
    "densityKgM3" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_geometries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_profiles" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "materialDefinitionId" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "supplierCode" TEXT,
    "standardLength" DECIMAL(12,4),
    "purchaseUnit" "PurchaseUnit" NOT NULL DEFAULT 'METER',
    "minOrderQty" DECIMAL(12,4),
    "coatingVariant" TEXT,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "procurement_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_prices" (
    "id" TEXT NOT NULL,
    "procurementProfileId" TEXT NOT NULL,
    "pricePerTon" DECIMAL(14,4) NOT NULL,
    "currency" "CurrencyCode" NOT NULL DEFAULT 'RUB',
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_mappings" (
    "id" TEXT NOT NULL,
    "procurementProfileId" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL,
    "confirmedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fromCurrency" "CurrencyCode" NOT NULL,
    "toCurrency" "CurrencyCode" NOT NULL,
    "rate" DECIMAL(16,8) NOT NULL,
    "validAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "mode" "OrderMode" NOT NULL DEFAULT 'STANDARD',
    "dueDate" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phases" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phaseNumber" INTEGER NOT NULL,
    "status" "PhaseStatus" NOT NULL DEFAULT 'PLANNED',
    "plannedShipDate" TIMESTAMP(3),
    "actualShipDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "phases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assemblies" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "phaseId" TEXT,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "projectSteelGrade" "SteelGrade",
    "actualSteelGrade" "SteelGrade",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assemblies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parts" (
    "id" TEXT NOT NULL,
    "assemblyId" TEXT NOT NULL,
    "materialDefinitionId" TEXT NOT NULL,
    "name" TEXT,
    "measurementType" "MeasurementType" NOT NULL,
    "length" DECIMAL(12,4),
    "sheetWidth" DECIMAL(12,4),
    "sheetHeight" DECIMAL(12,4),
    "directWeightKg" DECIMAL(12,4),
    "quantity" INTEGER NOT NULL,
    "notes" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_centers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "WorkCenterType" NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routing_steps" (
    "id" TEXT NOT NULL,
    "assemblyId" TEXT NOT NULL,
    "workCenterId" TEXT NOT NULL,
    "operationType" "OperationType" NOT NULL,
    "sequence" INTEGER NOT NULL,
    "estimatedMin" INTEGER,
    "actualMin" INTEGER,
    "status" "StepStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routing_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_revisions" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "status" "RevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "currency" "CurrencyCode" NOT NULL DEFAULT 'RUB',
    "calculationVersion" TEXT NOT NULL DEFAULT '2.0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revision_parts" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "materialDefinitionId" TEXT,
    "procurementProfileId" TEXT,
    "materialCode" TEXT NOT NULL,
    "materialName" TEXT NOT NULL,
    "materialType" TEXT NOT NULL,
    "profileType" TEXT NOT NULL,
    "steelGrade" TEXT,
    "standard" TEXT,
    "supplierName" TEXT NOT NULL,
    "supplierCode" TEXT,
    "measurementType" TEXT NOT NULL,
    "length" DECIMAL(12,4),
    "sheetWidth" DECIMAL(12,4),
    "sheetHeight" DECIMAL(12,4),
    "quantity" INTEGER NOT NULL,
    "theoreticalWeightPerMeter" DECIMAL(12,6),
    "actualWeightPerMeter" DECIMAL(12,6),
    "weightPerSquareMeter" DECIMAL(12,6),
    "paintSurfacePerMeter" DECIMAL(12,6),
    "calculatedWeightPerUnit" DECIMAL(12,4) NOT NULL,
    "totalWeight" DECIMAL(12,4) NOT NULL,
    "paintAreaM2" DECIMAL(12,4),
    "pricePerTon" DECIMAL(14,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "materialCost" DECIMAL(14,4) NOT NULL,
    "assemblyName" TEXT,
    "phaseName" TEXT,
    "notes" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "revision_parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revision_cost_lines" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "category" "CostCategory" NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(14,4) NOT NULL,
    "currency" "CurrencyCode" NOT NULL DEFAULT 'RUB',
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "revision_cost_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revision_calculations" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "calculationVersion" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalWeightKg" DECIMAL(14,4) NOT NULL,
    "totalMaterialCost" DECIMAL(14,4) NOT NULL,
    "totalCost" DECIMAL(14,4) NOT NULL,
    "totalPaintM2" DECIMAL(14,4),
    "currency" "CurrencyCode" NOT NULL,
    "materialSummary" JSONB NOT NULL,
    "weightBreakdown" JSONB NOT NULL,
    "costBreakdown" JSONB NOT NULL,
    "pricingSummary" JSONB NOT NULL,
    "warnings" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "revision_calculations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "managed_files" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fileType" "FileType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "managed_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_versions" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "originalName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "uploadedById" TEXT,
    "changeNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_files" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "attachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_items" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "materialDefinitionId" TEXT NOT NULL,
    "procurementProfileId" TEXT,
    "warehouseLocation" TEXT,
    "lotNumber" TEXT,
    "quantityOnHand" DECIMAL(12,4) NOT NULL,
    "unit" "PurchaseUnit" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remnants" (
    "id" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "length" DECIMAL(12,4),
    "width" DECIMAL(12,4),
    "weightKg" DECIMAL(12,4),
    "isReserved" BOOLEAN NOT NULL DEFAULT false,
    "reservedForOrderId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "remnants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "diff" JSONB,
    "snapshot" JSONB,
    "correlationId" TEXT,
    "eventId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "material_definitions_geometryId_key" ON "material_definitions"("geometryId");

-- CreateIndex
CREATE UNIQUE INDEX "material_definitions_companyId_code_key" ON "material_definitions"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_mappings_supplierName_rawText_key" ON "supplier_mappings"("supplierName", "rawText");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_companyId_fromCurrency_toCurrency_validAt_key" ON "exchange_rates"("companyId", "fromCurrency", "toCurrency", "validAt");

-- CreateIndex
CREATE UNIQUE INDEX "orders_companyId_orderNumber_key" ON "orders"("companyId", "orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "phases_orderId_phaseNumber_key" ON "phases"("orderId", "phaseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "quote_revisions_orderId_revisionNumber_key" ON "quote_revisions"("orderId", "revisionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "revision_calculations_revisionId_key" ON "revision_calculations"("revisionId");

-- CreateIndex
CREATE UNIQUE INDEX "file_versions_fileId_versionNumber_key" ON "file_versions"("fileId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "order_files_orderId_fileId_key" ON "order_files"("orderId", "fileId");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_companyId_createdAt_idx" ON "audit_logs"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_correlationId_idx" ON "audit_logs"("correlationId");

-- CreateIndex
CREATE INDEX "outbox_events_processedAt_createdAt_idx" ON "outbox_events"("processedAt", "createdAt");

-- CreateIndex
CREATE INDEX "outbox_events_aggregateType_aggregateId_idx" ON "outbox_events"("aggregateType", "aggregateId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_definitions" ADD CONSTRAINT "material_definitions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_definitions" ADD CONSTRAINT "material_definitions_geometryId_fkey" FOREIGN KEY ("geometryId") REFERENCES "material_geometries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_profiles" ADD CONSTRAINT "procurement_profiles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_profiles" ADD CONSTRAINT "procurement_profiles_materialDefinitionId_fkey" FOREIGN KEY ("materialDefinitionId") REFERENCES "material_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_prices" ADD CONSTRAINT "material_prices_procurementProfileId_fkey" FOREIGN KEY ("procurementProfileId") REFERENCES "procurement_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_mappings" ADD CONSTRAINT "supplier_mappings_procurementProfileId_fkey" FOREIGN KEY ("procurementProfileId") REFERENCES "procurement_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phases" ADD CONSTRAINT "phases_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assemblies" ADD CONSTRAINT "assemblies_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assemblies" ADD CONSTRAINT "assemblies_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "phases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assemblies" ADD CONSTRAINT "assemblies_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "assemblies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parts" ADD CONSTRAINT "parts_assemblyId_fkey" FOREIGN KEY ("assemblyId") REFERENCES "assemblies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parts" ADD CONSTRAINT "parts_materialDefinitionId_fkey" FOREIGN KEY ("materialDefinitionId") REFERENCES "material_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_centers" ADD CONSTRAINT "work_centers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routing_steps" ADD CONSTRAINT "routing_steps_assemblyId_fkey" FOREIGN KEY ("assemblyId") REFERENCES "assemblies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routing_steps" ADD CONSTRAINT "routing_steps_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "work_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_revisions" ADD CONSTRAINT "quote_revisions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_revisions" ADD CONSTRAINT "quote_revisions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_parts" ADD CONSTRAINT "revision_parts_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "quote_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_cost_lines" ADD CONSTRAINT "revision_cost_lines_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "quote_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_calculations" ADD CONSTRAINT "revision_calculations_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "quote_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "managed_files" ADD CONSTRAINT "managed_files_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "managed_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_files" ADD CONSTRAINT "order_files_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_files" ADD CONSTRAINT "order_files_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "managed_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "managed_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_materialDefinitionId_fkey" FOREIGN KEY ("materialDefinitionId") REFERENCES "material_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remnants" ADD CONSTRAINT "remnants_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
