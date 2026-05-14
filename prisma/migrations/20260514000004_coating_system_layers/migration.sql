-- CreateTable: coating_system_layers
CREATE TABLE "coating_system_layers" (
    "id"                TEXT        NOT NULL,
    "coatingSystemId"   TEXT        NOT NULL,
    "coatingMaterialId" TEXT        NOT NULL,
    "layerNumber"       INTEGER     NOT NULL,
    "selectedDftMkm"    INTEGER,
    "dilutionPercent"   DECIMAL(5,2),
    "notes"             TEXT,
    "position"          INTEGER     NOT NULL DEFAULT 0,
    "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "coating_system_layers_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "coating_system_layers"
    ADD CONSTRAINT "coating_system_layers_coatingSystemId_fkey"
    FOREIGN KEY ("coatingSystemId") REFERENCES "coating_systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coating_system_layers"
    ADD CONSTRAINT "coating_system_layers_coatingMaterialId_fkey"
    FOREIGN KEY ("coatingMaterialId") REFERENCES "coating_materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "coating_system_layers_coatingSystemId_position_idx"
    ON "coating_system_layers"("coatingSystemId", "position");
