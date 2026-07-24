-- Batch 4: sales CRM, opportunity pipeline, follow-ups, proposal tracking,
-- and controlled conversion from qualified demand into clients and projects.

CREATE TYPE "SalesOpportunityStage" AS ENUM (
  'NEW',
  'DISCOVERY',
  'QUALIFIED',
  'PROPOSAL',
  'NEGOTIATION',
  'ON_HOLD',
  'WON',
  'LOST'
);

CREATE TYPE "SalesActivityType" AS ENUM (
  'CALL',
  'WHATSAPP',
  'EMAIL',
  'MEETING',
  'FOLLOW_UP',
  'NOTE'
);

CREATE TYPE "SalesActivityStatus" AS ENUM (
  'PLANNED',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE "SalesProposalStatus" AS ENUM (
  'DRAFT',
  'SENT',
  'ACCEPTED',
  'REJECTED',
  'CANCELLED'
);

ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'SALES_OPPORTUNITY_CREATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'SALES_OPPORTUNITY_UPDATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'SALES_OPPORTUNITY_STAGE_CHANGED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'SALES_OPPORTUNITY_WON';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'SALES_OPPORTUNITY_LOST';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'SALES_OPPORTUNITY_CONVERTED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'SALES_ACTIVITY_CREATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'SALES_ACTIVITY_UPDATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'SALES_ACTIVITY_COMPLETED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'SALES_PROPOSAL_CREATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'SALES_PROPOSAL_UPDATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'SALES_PROPOSAL_SENT';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'SALES_PROPOSAL_ACCEPTED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'SALES_PROPOSAL_REJECTED';

CREATE TABLE "SalesOpportunity" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "serviceRequestId" TEXT,
  "clientId" TEXT,
  "projectId" TEXT,
  "ownerId" TEXT,
  "title" TEXT NOT NULL,
  "contactName" TEXT NOT NULL,
  "companyName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "serviceType" TEXT NOT NULL,
  "stage" "SalesOpportunityStage" NOT NULL DEFAULT 'NEW',
  "priority" "ServiceRequestPriority" NOT NULL DEFAULT 'MEDIUM',
  "source" "ServiceRequestSource" NOT NULL DEFAULT 'MANUAL',
  "estimatedValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'JOD',
  "probability" INTEGER NOT NULL DEFAULT 10,
  "expectedCloseDate" TIMESTAMP(3),
  "nextFollowUpAt" TIMESTAMP(3),
  "lastContactAt" TIMESTAMP(3),
  "lostReason" TEXT,
  "notes" TEXT,
  "wonAt" TIMESTAMP(3),
  "lostAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SalesOpportunity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SalesOpportunity_value_check" CHECK ("estimatedValue" >= 0),
  CONSTRAINT "SalesOpportunity_currency_check" CHECK (char_length("currency") = 3),
  CONSTRAINT "SalesOpportunity_probability_check" CHECK ("probability" BETWEEN 0 AND 100),
  CONSTRAINT "SalesOpportunity_terminal_state_check" CHECK (
    ("stage" = 'WON' AND "probability" = 100 AND "wonAt" IS NOT NULL AND "lostAt" IS NULL AND "lostReason" IS NULL) OR
    ("stage" = 'LOST' AND "probability" = 0 AND "lostAt" IS NOT NULL AND "lostReason" IS NOT NULL AND "wonAt" IS NULL) OR
    ("stage" NOT IN ('WON', 'LOST') AND "wonAt" IS NULL AND "lostAt" IS NULL AND "lostReason" IS NULL)
  )
);

CREATE TABLE "SalesActivity" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "opportunityId" TEXT NOT NULL,
  "createdById" TEXT,
  "type" "SalesActivityType" NOT NULL,
  "status" "SalesActivityStatus" NOT NULL DEFAULT 'PLANNED',
  "subject" TEXT NOT NULL,
  "details" TEXT,
  "outcome" TEXT,
  "scheduledAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SalesActivity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SalesActivity_status_time_check" CHECK (
    ("status" = 'PLANNED' AND "scheduledAt" IS NOT NULL AND "completedAt" IS NULL) OR
    ("status" = 'COMPLETED' AND "completedAt" IS NOT NULL) OR
    ("status" = 'CANCELLED' AND "completedAt" IS NULL)
  )
);

CREATE TABLE "SalesProposal" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "opportunityId" TEXT NOT NULL,
  "createdById" TEXT,
  "proposalNumber" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "SalesProposalStatus" NOT NULL DEFAULT 'DRAFT',
  "title" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'JOD',
  "validUntil" TIMESTAMP(3),
  "url" TEXT,
  "notes" TEXT,
  "sentAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SalesProposal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SalesProposal_version_check" CHECK ("version" >= 1),
  CONSTRAINT "SalesProposal_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "SalesProposal_currency_check" CHECK (char_length("currency") = 3),
  CONSTRAINT "SalesProposal_status_time_check" CHECK (
    ("status" = 'DRAFT' AND "sentAt" IS NULL AND "acceptedAt" IS NULL AND "rejectedAt" IS NULL) OR
    ("status" = 'SENT' AND "sentAt" IS NOT NULL AND "acceptedAt" IS NULL AND "rejectedAt" IS NULL) OR
    ("status" = 'ACCEPTED' AND "sentAt" IS NOT NULL AND "acceptedAt" IS NOT NULL AND "rejectedAt" IS NULL) OR
    ("status" = 'REJECTED' AND "sentAt" IS NOT NULL AND "rejectedAt" IS NOT NULL AND "acceptedAt" IS NULL) OR
    ("status" = 'CANCELLED')
  )
);

CREATE UNIQUE INDEX "SalesOpportunity_serviceRequestId_key"
  ON "SalesOpportunity"("serviceRequestId");
CREATE UNIQUE INDEX "SalesOpportunity_projectId_key"
  ON "SalesOpportunity"("projectId");
CREATE INDEX "SalesOpportunity_companyId_idx" ON "SalesOpportunity"("companyId");
CREATE INDEX "SalesOpportunity_clientId_idx" ON "SalesOpportunity"("clientId");
CREATE INDEX "SalesOpportunity_projectId_idx" ON "SalesOpportunity"("projectId");
CREATE INDEX "SalesOpportunity_ownerId_idx" ON "SalesOpportunity"("ownerId");
CREATE INDEX "SalesOpportunity_stage_idx" ON "SalesOpportunity"("stage");
CREATE INDEX "SalesOpportunity_priority_idx" ON "SalesOpportunity"("priority");
CREATE INDEX "SalesOpportunity_source_idx" ON "SalesOpportunity"("source");
CREATE INDEX "SalesOpportunity_expectedCloseDate_idx" ON "SalesOpportunity"("expectedCloseDate");
CREATE INDEX "SalesOpportunity_nextFollowUpAt_idx" ON "SalesOpportunity"("nextFollowUpAt");
CREATE INDEX "SalesOpportunity_updatedAt_idx" ON "SalesOpportunity"("updatedAt");

CREATE INDEX "SalesActivity_companyId_idx" ON "SalesActivity"("companyId");
CREATE INDEX "SalesActivity_opportunityId_idx" ON "SalesActivity"("opportunityId");
CREATE INDEX "SalesActivity_createdById_idx" ON "SalesActivity"("createdById");
CREATE INDEX "SalesActivity_type_idx" ON "SalesActivity"("type");
CREATE INDEX "SalesActivity_status_idx" ON "SalesActivity"("status");
CREATE INDEX "SalesActivity_scheduledAt_idx" ON "SalesActivity"("scheduledAt");
CREATE INDEX "SalesActivity_completedAt_idx" ON "SalesActivity"("completedAt");

CREATE UNIQUE INDEX "SalesProposal_companyId_proposalNumber_key"
  ON "SalesProposal"("companyId", "proposalNumber");
CREATE UNIQUE INDEX "SalesProposal_opportunityId_version_key"
  ON "SalesProposal"("opportunityId", "version");
CREATE INDEX "SalesProposal_companyId_idx" ON "SalesProposal"("companyId");
CREATE INDEX "SalesProposal_opportunityId_idx" ON "SalesProposal"("opportunityId");
CREATE INDEX "SalesProposal_createdById_idx" ON "SalesProposal"("createdById");
CREATE INDEX "SalesProposal_status_idx" ON "SalesProposal"("status");
CREATE INDEX "SalesProposal_validUntil_idx" ON "SalesProposal"("validUntil");

ALTER TABLE "SalesOpportunity"
  ADD CONSTRAINT "SalesOpportunity_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesOpportunity"
  ADD CONSTRAINT "SalesOpportunity_serviceRequestId_fkey"
  FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesOpportunity"
  ADD CONSTRAINT "SalesOpportunity_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesOpportunity"
  ADD CONSTRAINT "SalesOpportunity_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesOpportunity"
  ADD CONSTRAINT "SalesOpportunity_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SalesActivity"
  ADD CONSTRAINT "SalesActivity_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesActivity"
  ADD CONSTRAINT "SalesActivity_opportunityId_fkey"
  FOREIGN KEY ("opportunityId") REFERENCES "SalesOpportunity"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesActivity"
  ADD CONSTRAINT "SalesActivity_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SalesProposal"
  ADD CONSTRAINT "SalesProposal_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesProposal"
  ADD CONSTRAINT "SalesProposal_opportunityId_fkey"
  FOREIGN KEY ("opportunityId") REFERENCES "SalesOpportunity"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesProposal"
  ADD CONSTRAINT "SalesProposal_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing intake records become pipeline opportunities so the CRM starts with
-- historical continuity instead of an empty board after migration.
INSERT INTO "SalesOpportunity" (
  "id",
  "companyId",
  "serviceRequestId",
  "clientId",
  "projectId",
  "ownerId",
  "title",
  "contactName",
  "companyName",
  "email",
  "phone",
  "serviceType",
  "stage",
  "priority",
  "source",
  "estimatedValue",
  "currency",
  "probability",
  "lostReason",
  "notes",
  "wonAt",
  "lostAt",
  "createdAt",
  "updatedAt"
)
SELECT
  'sales_opportunity_' || md5(sr."id"),
  sr."companyId",
  sr."id",
  sr."clientId",
  sr."projectId",
  sr."assignedToId",
  sr."serviceType" || ' - ' || COALESCE(NULLIF(trim(sr."customerCompany"), ''), sr."customerName"),
  sr."customerName",
  sr."customerCompany",
  sr."customerEmail",
  sr."customerPhone",
  sr."serviceType",
  CASE sr."status"
    WHEN 'CONTACTED' THEN 'DISCOVERY'::"SalesOpportunityStage"
    WHEN 'QUALIFIED' THEN 'QUALIFIED'::"SalesOpportunityStage"
    WHEN 'PROPOSAL_SENT' THEN 'PROPOSAL'::"SalesOpportunityStage"
    WHEN 'APPROVED' THEN 'NEGOTIATION'::"SalesOpportunityStage"
    WHEN 'REJECTED' THEN 'LOST'::"SalesOpportunityStage"
    WHEN 'CONVERTED' THEN 'WON'::"SalesOpportunityStage"
    WHEN 'ARCHIVED' THEN 'ON_HOLD'::"SalesOpportunityStage"
    ELSE 'NEW'::"SalesOpportunityStage"
  END,
  sr."priority",
  sr."source",
  0,
  c."currency",
  CASE sr."status"
    WHEN 'CONTACTED' THEN 20
    WHEN 'QUALIFIED' THEN 40
    WHEN 'PROPOSAL_SENT' THEN 60
    WHEN 'APPROVED' THEN 80
    WHEN 'REJECTED' THEN 0
    WHEN 'CONVERTED' THEN 100
    WHEN 'ARCHIVED' THEN 25
    ELSE 10
  END,
  CASE WHEN sr."status" = 'REJECTED' THEN 'مرفوض من طلب الخدمة' ELSE NULL END,
  sr."message",
  CASE WHEN sr."status" = 'CONVERTED' THEN COALESCE(sr."convertedAt", sr."updatedAt") ELSE NULL END,
  CASE WHEN sr."status" = 'REJECTED' THEN COALESCE(sr."rejectedAt", sr."updatedAt") ELSE NULL END,
  sr."createdAt",
  sr."updatedAt"
FROM "ServiceRequest" sr
JOIN "Company" c ON c."id" = sr."companyId"
ON CONFLICT ("serviceRequestId") DO NOTHING;
