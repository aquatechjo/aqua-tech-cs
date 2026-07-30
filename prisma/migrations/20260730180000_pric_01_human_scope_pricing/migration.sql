CREATE TYPE "PricingWorkspaceStatus" AS ENUM (
    'DRAFT',
    'IN_REVIEW',
    'CHANGES_REQUESTED',
    'APPROVED'
);

ALTER TYPE "ActivityAction"
ADD VALUE IF NOT EXISTS 'PRICING_VERSION_CREATED';

ALTER TYPE "ActivityAction"
ADD VALUE IF NOT EXISTS 'PRICING_SUBMITTED';

ALTER TYPE "ActivityAction"
ADD VALUE IF NOT EXISTS 'PRICING_CHANGES_REQUESTED';

ALTER TYPE "ActivityAction"
ADD VALUE IF NOT EXISTS 'PRICING_APPROVED';

CREATE TABLE "PricingWorkspace" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "intakeSessionId" TEXT NOT NULL,
    "discoveryReportId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "createdById" TEXT,
    "reviewedById" TEXT,
    "status" "PricingWorkspaceStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersion" INTEGER NOT NULL DEFAULT 0,
    "reviewNotes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "changesRequestedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingWorkspace_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PricingWorkspace_currentVersion_check"
      CHECK ("currentVersion" >= 0)
);

CREATE TABLE "PricingVersion" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdById" TEXT,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "discoveryReportVersion" INTEGER NOT NULL,
    "discoveryContentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricingVersion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PricingVersion_version_check"
      CHECK ("version" > 0),
    CONSTRAINT "PricingVersion_discoveryReportVersion_check"
      CHECK ("discoveryReportVersion" > 0)
);

CREATE UNIQUE INDEX "PricingWorkspace_intakeSessionId_key"
ON "PricingWorkspace"("intakeSessionId");

CREATE UNIQUE INDEX "PricingWorkspace_discoveryReportId_key"
ON "PricingWorkspace"("discoveryReportId");

CREATE UNIQUE INDEX "PricingWorkspace_opportunityId_key"
ON "PricingWorkspace"("opportunityId");

CREATE INDEX "PricingWorkspace_companyId_idx"
ON "PricingWorkspace"("companyId");

CREATE INDEX "PricingWorkspace_createdById_idx"
ON "PricingWorkspace"("createdById");

CREATE INDEX "PricingWorkspace_reviewedById_idx"
ON "PricingWorkspace"("reviewedById");

CREATE INDEX "PricingWorkspace_status_idx"
ON "PricingWorkspace"("status");

CREATE INDEX "PricingWorkspace_updatedAt_idx"
ON "PricingWorkspace"("updatedAt");

CREATE UNIQUE INDEX "PricingVersion_workspaceId_version_key"
ON "PricingVersion"("workspaceId", "version");

CREATE INDEX "PricingVersion_companyId_idx"
ON "PricingVersion"("companyId");

CREATE INDEX "PricingVersion_createdById_idx"
ON "PricingVersion"("createdById");

CREATE INDEX "PricingVersion_discoveryContentHash_idx"
ON "PricingVersion"("discoveryContentHash");

CREATE INDEX "PricingVersion_createdAt_idx"
ON "PricingVersion"("createdAt");

ALTER TABLE "PricingWorkspace"
ADD CONSTRAINT "PricingWorkspace_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PricingWorkspace"
ADD CONSTRAINT "PricingWorkspace_intakeSessionId_fkey"
FOREIGN KEY ("intakeSessionId") REFERENCES "IntakeSession"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PricingWorkspace"
ADD CONSTRAINT "PricingWorkspace_discoveryReportId_fkey"
FOREIGN KEY ("discoveryReportId") REFERENCES "DiscoveryReport"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PricingWorkspace"
ADD CONSTRAINT "PricingWorkspace_opportunityId_fkey"
FOREIGN KEY ("opportunityId") REFERENCES "SalesOpportunity"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PricingWorkspace"
ADD CONSTRAINT "PricingWorkspace_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PricingWorkspace"
ADD CONSTRAINT "PricingWorkspace_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PricingVersion"
ADD CONSTRAINT "PricingVersion_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PricingVersion"
ADD CONSTRAINT "PricingVersion_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "PricingWorkspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PricingVersion"
ADD CONSTRAINT "PricingVersion_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
