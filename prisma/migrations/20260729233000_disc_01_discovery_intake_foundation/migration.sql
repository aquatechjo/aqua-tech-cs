CREATE TYPE "DiscoveryServiceTrack" AS ENUM (
    'WEBSITE_COMMERCE',
    'SOFTWARE_SAAS',
    'AUTOMATION_AI',
    'MARKETING_GROWTH',
    'GENERAL'
);

CREATE TYPE "IntakeSessionStatus" AS ENUM (
    'COLLECTING',
    'NEEDS_INFO',
    'READY_FOR_REVIEW',
    'COMPLETED',
    'ARCHIVED'
);

CREATE TYPE "IntakeAnswerSource" AS ENUM (
    'CUSTOMER_FACT',
    'UPLOADED_EVIDENCE',
    'AI_INFERENCE',
    'INTERNAL_NOTE',
    'APPROVED_DECISION'
);

CREATE TYPE "RequirementGapSeverity" AS ENUM (
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);

CREATE TYPE "RequirementGapStatus" AS ENUM (
    'OPEN',
    'RESOLVED',
    'WAIVED'
);

ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'DISCOVERY_SESSION_CREATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'DISCOVERY_SESSION_UPDATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'DISCOVERY_READY_FOR_REVIEW';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'DISCOVERY_GAP_WAIVED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'DISCOVERY_GAP_REOPENED';

CREATE TABLE "IntakeSession" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "ownerId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "serviceTrack" "DiscoveryServiceTrack" NOT NULL,
    "templateVersion" TEXT NOT NULL DEFAULT 'DISCOVERY_V1',
    "status" "IntakeSessionStatus" NOT NULL DEFAULT 'COLLECTING',
    "completionScore" INTEGER NOT NULL DEFAULT 0,
    "currentSection" TEXT,
    "internalSummary" TEXT,
    "readyForReviewAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntakeSession_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "IntakeSession_completionScore_check"
        CHECK ("completionScore" >= 0 AND "completionScore" <= 100)
);

CREATE TABLE "IntakeAnswer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "intakeSessionId" TEXT NOT NULL,
    "capturedById" TEXT,
    "questionKey" TEXT NOT NULL,
    "questionLabel" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "source" "IntakeAnswerSource" NOT NULL DEFAULT 'CUSTOMER_FACT',
    "isUnknown" BOOLEAN NOT NULL DEFAULT false,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntakeAnswer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RequirementGap" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "intakeSessionId" TEXT NOT NULL,
    "resolvedById" TEXT,
    "questionKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "severity" "RequirementGapSeverity" NOT NULL,
    "status" "RequirementGapStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequirementGap_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IntakeSession_leadId_key"
ON "IntakeSession"("leadId");

CREATE UNIQUE INDEX "IntakeSession_opportunityId_key"
ON "IntakeSession"("opportunityId");

CREATE INDEX "IntakeSession_companyId_idx"
ON "IntakeSession"("companyId");

CREATE INDEX "IntakeSession_ownerId_idx"
ON "IntakeSession"("ownerId");

CREATE INDEX "IntakeSession_status_idx"
ON "IntakeSession"("status");

CREATE INDEX "IntakeSession_serviceTrack_idx"
ON "IntakeSession"("serviceTrack");

CREATE INDEX "IntakeSession_updatedAt_idx"
ON "IntakeSession"("updatedAt");

CREATE UNIQUE INDEX "IntakeAnswer_intakeSessionId_questionKey_key"
ON "IntakeAnswer"("intakeSessionId", "questionKey");

CREATE INDEX "IntakeAnswer_companyId_idx"
ON "IntakeAnswer"("companyId");

CREATE INDEX "IntakeAnswer_capturedById_idx"
ON "IntakeAnswer"("capturedById");

CREATE INDEX "IntakeAnswer_source_idx"
ON "IntakeAnswer"("source");

CREATE INDEX "IntakeAnswer_sectionKey_idx"
ON "IntakeAnswer"("sectionKey");

CREATE INDEX "IntakeAnswer_updatedAt_idx"
ON "IntakeAnswer"("updatedAt");

CREATE UNIQUE INDEX "RequirementGap_intakeSessionId_questionKey_key"
ON "RequirementGap"("intakeSessionId", "questionKey");

CREATE INDEX "RequirementGap_companyId_idx"
ON "RequirementGap"("companyId");

CREATE INDEX "RequirementGap_resolvedById_idx"
ON "RequirementGap"("resolvedById");

CREATE INDEX "RequirementGap_status_idx"
ON "RequirementGap"("status");

CREATE INDEX "RequirementGap_severity_idx"
ON "RequirementGap"("severity");

CREATE INDEX "RequirementGap_updatedAt_idx"
ON "RequirementGap"("updatedAt");

ALTER TABLE "IntakeSession"
ADD CONSTRAINT "IntakeSession_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IntakeSession"
ADD CONSTRAINT "IntakeSession_leadId_fkey"
FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IntakeSession"
ADD CONSTRAINT "IntakeSession_opportunityId_fkey"
FOREIGN KEY ("opportunityId") REFERENCES "SalesOpportunity"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IntakeSession"
ADD CONSTRAINT "IntakeSession_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IntakeSession"
ADD CONSTRAINT "IntakeSession_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IntakeSession"
ADD CONSTRAINT "IntakeSession_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IntakeAnswer"
ADD CONSTRAINT "IntakeAnswer_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IntakeAnswer"
ADD CONSTRAINT "IntakeAnswer_intakeSessionId_fkey"
FOREIGN KEY ("intakeSessionId") REFERENCES "IntakeSession"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IntakeAnswer"
ADD CONSTRAINT "IntakeAnswer_capturedById_fkey"
FOREIGN KEY ("capturedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RequirementGap"
ADD CONSTRAINT "RequirementGap_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RequirementGap"
ADD CONSTRAINT "RequirementGap_intakeSessionId_fkey"
FOREIGN KEY ("intakeSessionId") REFERENCES "IntakeSession"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RequirementGap"
ADD CONSTRAINT "RequirementGap_resolvedById_fkey"
FOREIGN KEY ("resolvedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
