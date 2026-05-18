CREATE TYPE "CustomerPriority" AS ENUM ('VIP', 'HIGH', 'NORMAL', 'LOW');
CREATE TYPE "InteractionType" AS ENUM ('EMAIL', 'CALL', 'MEETING', 'NOTE');
CREATE TYPE "InteractionDirection" AS ENUM ('INBOUND', 'OUTBOUND');

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customerId" TEXT;

CREATE TABLE "crm_customers" (
  "id"        TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "inn"       TEXT,
  "phone"     TEXT,
  "email"     TEXT,
  "website"   TEXT,
  "notes"     TEXT,
  "priority"  "CustomerPriority" NOT NULL DEFAULT 'NORMAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "crm_customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_contacts" (
  "id"         TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "phone"      TEXT,
  "email"      TEXT,
  "position"   TEXT,
  "notes"      TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "crm_contacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_interactions" (
  "id"             TEXT NOT NULL,
  "customerId"     TEXT NOT NULL,
  "contactId"      TEXT,
  "orderId"        TEXT,
  "type"           "InteractionType" NOT NULL,
  "direction"      "InteractionDirection" NOT NULL,
  "subject"        TEXT,
  "body"           TEXT,
  "emailMessageId" TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById"    TEXT NOT NULL,
  CONSTRAINT "crm_interactions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "orders" ADD CONSTRAINT "orders_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "crm_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_customers" ADD CONSTRAINT "crm_customers_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "crm_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_interactions" ADD CONSTRAINT "crm_interactions_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "crm_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm_interactions" ADD CONSTRAINT "crm_interactions_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_interactions" ADD CONSTRAINT "crm_interactions_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_interactions" ADD CONSTRAINT "crm_interactions_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "crm_customers_companyId_idx"      ON "crm_customers"("companyId");
CREATE INDEX "crm_customers_email_idx"           ON "crm_customers"("email");
CREATE INDEX "crm_contacts_customerId_idx"       ON "crm_contacts"("customerId");
CREATE INDEX "crm_contacts_email_idx"            ON "crm_contacts"("email");
CREATE INDEX "crm_interactions_customerId_idx"   ON "crm_interactions"("customerId");
CREATE INDEX "crm_interactions_orderId_idx"      ON "crm_interactions"("orderId");
CREATE UNIQUE INDEX "crm_interactions_emailMessageId_key"
  ON "crm_interactions"("emailMessageId") WHERE "emailMessageId" IS NOT NULL;
CREATE INDEX "orders_customerId_idx" ON "orders"("customerId");
