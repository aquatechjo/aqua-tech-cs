ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'CONTACT_CREATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'CONTACT_UPDATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'CONTACT_ARCHIVED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'CONTACT_RESTORED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'CONTACT_PRIMARY_CHANGED';

CREATE TABLE "ClientContact" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jobTitle" TEXT,
    "department" TEXT,
    "email" TEXT,
    "emailNormalized" TEXT,
    "phone" TEXT,
    "phoneNormalized" TEXT,
    "whatsapp" TEXT,
    "whatsappNormalized" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isDecisionMaker" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientContact_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ClientContact" (
    "id",
    "companyId",
    "clientId",
    "name",
    "email",
    "emailNormalized",
    "phone",
    "phoneNormalized",
    "isPrimary",
    "isDecisionMaker",
    "createdAt",
    "updatedAt"
)
SELECT
    CONCAT('crm03_', md5("id")),
    "companyId",
    "id",
    "name",
    "email",
    CASE
        WHEN NULLIF(BTRIM("email"), '') IS NULL THEN NULL
        ELSE LOWER(BTRIM("email"))
    END,
    "phone",
    NULLIF(regexp_replace(COALESCE("phone", ''), '[^0-9]', '', 'g'), ''),
    true,
    CASE WHEN "type" = 'INDIVIDUAL' THEN true ELSE false END,
    "createdAt",
    "updatedAt"
FROM "Client"
WHERE NULLIF(BTRIM(COALESCE("email", '')), '') IS NOT NULL
   OR NULLIF(BTRIM(COALESCE("phone", '')), '') IS NOT NULL;

CREATE INDEX "ClientContact_companyId_idx" ON "ClientContact"("companyId");
CREATE INDEX "ClientContact_clientId_idx" ON "ClientContact"("clientId");
CREATE INDEX "ClientContact_emailNormalized_idx" ON "ClientContact"("emailNormalized");
CREATE INDEX "ClientContact_phoneNormalized_idx" ON "ClientContact"("phoneNormalized");
CREATE INDEX "ClientContact_whatsappNormalized_idx" ON "ClientContact"("whatsappNormalized");
CREATE INDEX "ClientContact_isPrimary_idx" ON "ClientContact"("isPrimary");
CREATE INDEX "ClientContact_isDecisionMaker_idx" ON "ClientContact"("isDecisionMaker");
CREATE INDEX "ClientContact_archivedAt_idx" ON "ClientContact"("archivedAt");
CREATE INDEX "ClientContact_createdAt_idx" ON "ClientContact"("createdAt");

CREATE UNIQUE INDEX "ClientContact_one_primary_per_client"
ON "ClientContact"("clientId")
WHERE "isPrimary" = true AND "archivedAt" IS NULL;

ALTER TABLE "ClientContact"
ADD CONSTRAINT "ClientContact_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientContact"
ADD CONSTRAINT "ClientContact_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
