CREATE TYPE "DiscoveryReportStatus" AS ENUM (
    'DRAFT',
    'IN_REVIEW',
    'CHANGES_REQUESTED',
    'APPROVED'
);

CREATE TYPE "DiscoveryReportVersionOrigin" AS ENUM (
    'AI_DRAFT',
    'HUMAN_REVISION'
);

ALTER TYPE "ActivityAction"
ADD VALUE IF NOT EXISTS 'DISCOVERY_REPORT_AI_GENERATED';

ALTER TYPE "ActivityAction"
ADD VALUE IF NOT EXISTS 'DISCOVERY_REPORT_VERSION_CREATED';

ALTER TYPE "ActivityAction"
ADD VALUE IF NOT EXISTS 'DISCOVERY_REPORT_SUBMITTED';

ALTER TYPE "ActivityAction"
ADD VALUE IF NOT EXISTS 'DISCOVERY_REPORT_CHANGES_REQUESTED';

ALTER TYPE "ActivityAction"
ADD VALUE IF NOT EXISTS 'DISCOVERY_REPORT_APPROVED';

CREATE TABLE "DiscoveryReport" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "intakeSessionId" TEXT NOT NULL,
    "createdById" TEXT,
    "aiAuthorizedById" TEXT,
    "reviewedById" TEXT,
    "status" "DiscoveryReportStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersion" INTEGER NOT NULL DEFAULT 0,
    "reviewNotes" TEXT,
    "aiAuthorizedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "changesRequestedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoveryReport_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DiscoveryReport_currentVersion_check"
      CHECK ("currentVersion" >= 0)
);

CREATE TABLE "DiscoveryReportVersion" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "createdById" TEXT,
    "version" INTEGER NOT NULL,
    "origin" "DiscoveryReportVersionOrigin" NOT NULL,
    "content" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "evidenceSnapshot" JSONB NOT NULL,
    "evidenceInputHash" TEXT NOT NULL,
    "promptVersion" TEXT,
    "aiProvider" TEXT,
    "aiModel" TEXT,
    "aiResponseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscoveryReportVersion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DiscoveryReportVersion_version_check"
      CHECK ("version" > 0)
);

CREATE UNIQUE INDEX "DiscoveryReport_intakeSessionId_key"
ON "DiscoveryReport"("intakeSessionId");

CREATE INDEX "DiscoveryReport_companyId_idx"
ON "DiscoveryReport"("companyId");

CREATE INDEX "DiscoveryReport_createdById_idx"
ON "DiscoveryReport"("createdById");

CREATE INDEX "DiscoveryReport_aiAuthorizedById_idx"
ON "DiscoveryReport"("aiAuthorizedById");

CREATE INDEX "DiscoveryReport_reviewedById_idx"
ON "DiscoveryReport"("reviewedById");

CREATE INDEX "DiscoveryReport_status_idx"
ON "DiscoveryReport"("status");

CREATE INDEX "DiscoveryReport_updatedAt_idx"
ON "DiscoveryReport"("updatedAt");

CREATE UNIQUE INDEX "DiscoveryReportVersion_reportId_version_key"
ON "DiscoveryReportVersion"("reportId", "version");

CREATE INDEX "DiscoveryReportVersion_companyId_idx"
ON "DiscoveryReportVersion"("companyId");

CREATE INDEX "DiscoveryReportVersion_createdById_idx"
ON "DiscoveryReportVersion"("createdById");

CREATE INDEX "DiscoveryReportVersion_origin_idx"
ON "DiscoveryReportVersion"("origin");

CREATE INDEX "DiscoveryReportVersion_evidenceInputHash_idx"
ON "DiscoveryReportVersion"("evidenceInputHash");

CREATE INDEX "DiscoveryReportVersion_createdAt_idx"
ON "DiscoveryReportVersion"("createdAt");

ALTER TABLE "DiscoveryReport"
ADD CONSTRAINT "DiscoveryReport_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DiscoveryReport"
ADD CONSTRAINT "DiscoveryReport_intakeSessionId_fkey"
FOREIGN KEY ("intakeSessionId") REFERENCES "IntakeSession"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DiscoveryReport"
ADD CONSTRAINT "DiscoveryReport_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DiscoveryReport"
ADD CONSTRAINT "DiscoveryReport_aiAuthorizedById_fkey"
FOREIGN KEY ("aiAuthorizedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DiscoveryReport"
ADD CONSTRAINT "DiscoveryReport_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DiscoveryReportVersion"
ADD CONSTRAINT "DiscoveryReportVersion_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DiscoveryReportVersion"
ADD CONSTRAINT "DiscoveryReportVersion_reportId_fkey"
FOREIGN KEY ("reportId") REFERENCES "DiscoveryReport"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DiscoveryReportVersion"
ADD CONSTRAINT "DiscoveryReportVersion_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
