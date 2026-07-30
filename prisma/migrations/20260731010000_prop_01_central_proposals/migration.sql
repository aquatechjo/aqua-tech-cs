CREATE TYPE "ProposalWorkspaceStatus" AS ENUM (
    'DRAFT',
    'IN_REVIEW',
    'CHANGES_REQUESTED',
    'APPROVED'
);

ALTER TYPE "ActivityAction"
ADD VALUE IF NOT EXISTS 'PROPOSAL_VERSION_CREATED';

ALTER TYPE "ActivityAction"
ADD VALUE IF NOT EXISTS 'PROPOSAL_SUBMITTED';

ALTER TYPE "ActivityAction"
ADD VALUE IF NOT EXISTS 'PROPOSAL_CHANGES_REQUESTED';

ALTER TYPE "ActivityAction"
ADD VALUE IF NOT EXISTS 'PROPOSAL_APPROVED';

CREATE TABLE "ProposalWorkspace" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "intakeSessionId" TEXT NOT NULL,
    "pricingWorkspaceId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "createdById" TEXT,
    "reviewedById" TEXT,
    "proposalNumber" TEXT NOT NULL,
    "status" "ProposalWorkspaceStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersion" INTEGER NOT NULL DEFAULT 0,
    "reviewNotes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "changesRequestedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProposalWorkspace_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProposalWorkspace_currentVersion_check"
      CHECK ("currentVersion" >= 0)
);

CREATE TABLE "ProposalVersion" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdById" TEXT,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "clientContentHash" TEXT NOT NULL,
    "pricingVersion" INTEGER NOT NULL,
    "pricingContentHash" TEXT NOT NULL,
    "discoveryReportVersion" INTEGER NOT NULL,
    "discoveryContentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalVersion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProposalVersion_version_check"
      CHECK ("version" > 0),
    CONSTRAINT "ProposalVersion_pricingVersion_check"
      CHECK ("pricingVersion" > 0),
    CONSTRAINT "ProposalVersion_discoveryReportVersion_check"
      CHECK ("discoveryReportVersion" > 0)
);

CREATE UNIQUE INDEX "ProposalWorkspace_intakeSessionId_key"
ON "ProposalWorkspace"("intakeSessionId");

CREATE UNIQUE INDEX "ProposalWorkspace_pricingWorkspaceId_key"
ON "ProposalWorkspace"("pricingWorkspaceId");

CREATE UNIQUE INDEX "ProposalWorkspace_opportunityId_key"
ON "ProposalWorkspace"("opportunityId");

CREATE UNIQUE INDEX "ProposalWorkspace_companyId_proposalNumber_key"
ON "ProposalWorkspace"("companyId", "proposalNumber");

CREATE INDEX "ProposalWorkspace_companyId_idx"
ON "ProposalWorkspace"("companyId");

CREATE INDEX "ProposalWorkspace_createdById_idx"
ON "ProposalWorkspace"("createdById");

CREATE INDEX "ProposalWorkspace_reviewedById_idx"
ON "ProposalWorkspace"("reviewedById");

CREATE INDEX "ProposalWorkspace_status_idx"
ON "ProposalWorkspace"("status");

CREATE INDEX "ProposalWorkspace_updatedAt_idx"
ON "ProposalWorkspace"("updatedAt");

CREATE UNIQUE INDEX "ProposalVersion_workspaceId_version_key"
ON "ProposalVersion"("workspaceId", "version");

CREATE INDEX "ProposalVersion_companyId_idx"
ON "ProposalVersion"("companyId");

CREATE INDEX "ProposalVersion_createdById_idx"
ON "ProposalVersion"("createdById");

CREATE INDEX "ProposalVersion_pricingContentHash_idx"
ON "ProposalVersion"("pricingContentHash");

CREATE INDEX "ProposalVersion_discoveryContentHash_idx"
ON "ProposalVersion"("discoveryContentHash");

CREATE INDEX "ProposalVersion_createdAt_idx"
ON "ProposalVersion"("createdAt");

ALTER TABLE "ProposalWorkspace"
ADD CONSTRAINT "ProposalWorkspace_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProposalWorkspace"
ADD CONSTRAINT "ProposalWorkspace_intakeSessionId_fkey"
FOREIGN KEY ("intakeSessionId") REFERENCES "IntakeSession"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProposalWorkspace"
ADD CONSTRAINT "ProposalWorkspace_pricingWorkspaceId_fkey"
FOREIGN KEY ("pricingWorkspaceId") REFERENCES "PricingWorkspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProposalWorkspace"
ADD CONSTRAINT "ProposalWorkspace_opportunityId_fkey"
FOREIGN KEY ("opportunityId") REFERENCES "SalesOpportunity"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProposalWorkspace"
ADD CONSTRAINT "ProposalWorkspace_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProposalWorkspace"
ADD CONSTRAINT "ProposalWorkspace_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProposalVersion"
ADD CONSTRAINT "ProposalVersion_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProposalVersion"
ADD CONSTRAINT "ProposalVersion_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "ProposalWorkspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProposalVersion"
ADD CONSTRAINT "ProposalVersion_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
