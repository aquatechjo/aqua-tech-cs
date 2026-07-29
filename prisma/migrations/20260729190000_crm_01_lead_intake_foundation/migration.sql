-- CRM-01: introduce a canonical lead qualification record without replacing
-- the existing intake request or sales opportunity history.

CREATE TYPE "LeadStatus" AS ENUM (
  'NEW',
  'CONTACTED',
  'DISCOVERY',
  'NEEDS_INFO',
  'QUALIFIED',
  'DISQUALIFIED',
  'NURTURE',
  'DUPLICATE',
  'SPAM',
  'CONVERTED',
  'ARCHIVED'
);

ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'CHATBOT';
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'EMAIL';
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'CALL';
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'MEETING';
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'CAMPAIGN';
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'MANUAL';

ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'LEAD_CREATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'LEAD_UPDATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'LEAD_STATUS_CHANGED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'LEAD_DUPLICATE_FLAGGED';

CREATE TABLE "Lead" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "serviceRequestId" TEXT,
  "clientId" TEXT,
  "ownerId" TEXT,
  "possibleDuplicateOfId" TEXT,
  "contactName" TEXT NOT NULL,
  "email" TEXT,
  "emailNormalized" TEXT,
  "phone" TEXT,
  "phoneNormalized" TEXT,
  "companyName" TEXT,
  "companyNormalized" TEXT,
  "serviceType" TEXT NOT NULL,
  "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
  "source" "LeadSource" NOT NULL DEFAULT 'OTHER',
  "priority" "ServiceRequestPriority" NOT NULL DEFAULT 'MEDIUM',
  "campaign" TEXT,
  "completionScore" INTEGER NOT NULL DEFAULT 0,
  "contactConsent" BOOLEAN,
  "contactConsentAt" TIMESTAMP(3),
  "nextAction" TEXT,
  "nextActionAt" TIMESTAMP(3),
  "notes" TEXT,
  "qualifiedAt" TIMESTAMP(3),
  "disqualifiedAt" TIMESTAMP(3),
  "convertedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Lead_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Lead_completion_score_check"
    CHECK ("completionScore" BETWEEN 0 AND 100),
  CONSTRAINT "Lead_consent_time_check"
    CHECK (
      ("contactConsent" IS NULL AND "contactConsentAt" IS NULL) OR
      ("contactConsent" IS NOT NULL AND "contactConsentAt" IS NOT NULL)
    )
);

ALTER TABLE "SalesOpportunity"
ADD COLUMN "leadId" TEXT;

CREATE UNIQUE INDEX "Lead_serviceRequestId_key"
ON "Lead"("serviceRequestId");
CREATE INDEX "Lead_companyId_idx" ON "Lead"("companyId");
CREATE INDEX "Lead_clientId_idx" ON "Lead"("clientId");
CREATE INDEX "Lead_ownerId_idx" ON "Lead"("ownerId");
CREATE INDEX "Lead_possibleDuplicateOfId_idx"
ON "Lead"("possibleDuplicateOfId");
CREATE INDEX "Lead_status_idx" ON "Lead"("status");
CREATE INDEX "Lead_source_idx" ON "Lead"("source");
CREATE INDEX "Lead_priority_idx" ON "Lead"("priority");
CREATE INDEX "Lead_emailNormalized_idx" ON "Lead"("emailNormalized");
CREATE INDEX "Lead_phoneNormalized_idx" ON "Lead"("phoneNormalized");
CREATE INDEX "Lead_companyNormalized_idx" ON "Lead"("companyNormalized");
CREATE INDEX "Lead_nextActionAt_idx" ON "Lead"("nextActionAt");
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

CREATE UNIQUE INDEX "SalesOpportunity_leadId_key"
ON "SalesOpportunity"("leadId");
CREATE INDEX "SalesOpportunity_leadId_idx"
ON "SalesOpportunity"("leadId");

ALTER TABLE "Lead"
ADD CONSTRAINT "Lead_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Lead"
ADD CONSTRAINT "Lead_serviceRequestId_fkey"
FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lead"
ADD CONSTRAINT "Lead_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lead"
ADD CONSTRAINT "Lead_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lead"
ADD CONSTRAINT "Lead_possibleDuplicateOfId_fkey"
FOREIGN KEY ("possibleDuplicateOfId") REFERENCES "Lead"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SalesOpportunity"
ADD CONSTRAINT "SalesOpportunity_leadId_fkey"
FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve all historical intake records as leads. ServiceRequest remains the
-- immutable intake snapshot; Lead becomes the qualification and ownership
-- record used by the CRM.
INSERT INTO "Lead" (
  "id",
  "companyId",
  "serviceRequestId",
  "clientId",
  "ownerId",
  "contactName",
  "email",
  "emailNormalized",
  "phone",
  "phoneNormalized",
  "companyName",
  "companyNormalized",
  "serviceType",
  "status",
  "source",
  "priority",
  "completionScore",
  "notes",
  "qualifiedAt",
  "disqualifiedAt",
  "convertedAt",
  "archivedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  'lead_' || md5(sr."id"),
  sr."companyId",
  sr."id",
  sr."clientId",
  COALESCE(
    sr."assignedToId",
    (
      SELECT u."id"
      FROM "User" u
      WHERE u."companyId" = sr."companyId"
        AND u."isActive" = true
        AND u."role" IN ('SALES_MANAGER', 'OWNER')
      ORDER BY
        CASE u."role"
          WHEN 'SALES_MANAGER' THEN 0
          ELSE 1
        END,
        u."createdAt" ASC
      LIMIT 1
    )
  ),
  sr."customerName",
  sr."customerEmail",
  NULLIF(lower(trim(sr."customerEmail")), ''),
  sr."customerPhone",
  NULLIF(regexp_replace(sr."customerPhone", '[^0-9]', '', 'g'), ''),
  sr."customerCompany",
  NULLIF(lower(regexp_replace(trim(sr."customerCompany"), '\s+', ' ', 'g')), ''),
  sr."serviceType",
  (
    CASE sr."status"
      WHEN 'CONTACTED' THEN 'CONTACTED'
      WHEN 'QUALIFIED' THEN 'QUALIFIED'
      WHEN 'PROPOSAL_SENT' THEN 'QUALIFIED'
      WHEN 'APPROVED' THEN 'QUALIFIED'
      WHEN 'REJECTED' THEN 'DISQUALIFIED'
      WHEN 'CONVERTED' THEN 'CONVERTED'
      WHEN 'ARCHIVED' THEN 'ARCHIVED'
      ELSE 'NEW'
    END
  )::"LeadStatus",
  (
    CASE sr."source"
      WHEN 'WEBSITE' THEN 'WEBSITE'
      WHEN 'MANUAL' THEN 'MANUAL'
      WHEN 'WHATSAPP' THEN 'WHATSAPP'
      WHEN 'INSTAGRAM' THEN 'INSTAGRAM'
      WHEN 'FACEBOOK' THEN 'FACEBOOK'
      WHEN 'REFERRAL' THEN 'REFERRAL'
      ELSE 'OTHER'
    END
  )::"LeadSource",
  sr."priority",
  LEAST(
    100,
    15
    + CASE
        WHEN NULLIF(trim(sr."customerEmail"), '') IS NOT NULL
          OR NULLIF(regexp_replace(sr."customerPhone", '[^0-9]', '', 'g'), '') IS NOT NULL
        THEN 20 ELSE 0
      END
    + CASE WHEN NULLIF(trim(sr."customerCompany"), '') IS NOT NULL THEN 10 ELSE 0 END
    + 20
    + CASE WHEN NULLIF(trim(sr."message"), '') IS NOT NULL THEN 15 ELSE 0 END
    + CASE WHEN NULLIF(trim(sr."budgetRange"), '') IS NOT NULL THEN 10 ELSE 0 END
    + CASE WHEN NULLIF(trim(sr."timeline"), '') IS NOT NULL THEN 5 ELSE 0 END
  ),
  sr."message",
  CASE
    WHEN sr."status" IN ('QUALIFIED', 'PROPOSAL_SENT', 'APPROVED')
    THEN COALESCE(sr."approvedAt", sr."updatedAt")
  END,
  CASE
    WHEN sr."status" = 'REJECTED'
    THEN COALESCE(sr."rejectedAt", sr."updatedAt")
  END,
  CASE
    WHEN sr."status" = 'CONVERTED'
    THEN COALESCE(sr."convertedAt", sr."updatedAt")
  END,
  CASE
    WHEN sr."status" = 'ARCHIVED'
    THEN sr."updatedAt"
  END,
  sr."createdAt",
  sr."updatedAt"
FROM "ServiceRequest" sr
ON CONFLICT ("serviceRequestId") DO NOTHING;

UPDATE "SalesOpportunity" opportunity
SET "leadId" = lead."id"
FROM "Lead" lead
WHERE lead."serviceRequestId" = opportunity."serviceRequestId"
  AND opportunity."leadId" IS NULL;
