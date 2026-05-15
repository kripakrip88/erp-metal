-- CreateTable: coating_systems
CREATE TABLE "coating_systems" (
    "id"        TEXT        NOT NULL,
    "companyId" TEXT        NOT NULL,
    "code"      TEXT        NOT NULL,
    "name"      TEXT        NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "coating_systems_pkey" PRIMARY KEY ("id")
);

-- AddColumn: coatingSystemId to assembly_coatings
ALTER TABLE "assembly_coatings" ADD COLUMN "coatingSystemId" TEXT;

-- AddForeignKey
ALTER TABLE "coating_systems"
    ADD CONSTRAINT "coating_systems_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddUniqueConstraint
ALTER TABLE "coating_systems"
    ADD CONSTRAINT "coating_systems_companyId_code_key" UNIQUE ("companyId", "code");

-- AddForeignKey
ALTER TABLE "assembly_coatings"
    ADD CONSTRAINT "assembly_coatings_coatingSystemId_fkey"
    FOREIGN KEY ("coatingSystemId") REFERENCES "coating_systems"("id") ON DELETE SET NULL ON UPDATE CASCADE;
