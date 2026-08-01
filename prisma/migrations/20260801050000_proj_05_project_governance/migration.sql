CREATE TYPE "ProjectGovernanceKind" AS ENUM ('RISK', 'ISSUE', 'DECISION');
CREATE TYPE "ProjectGovernanceStatus" AS ENUM (
  'OPEN',
  'MONITORING',
  'MITIGATED',
  'MATERIALIZED',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
  'RECORDED',
  'SUPERSEDED'
);
CREATE TYPE "ProjectGovernanceLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_RISK_CREATED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_RISK_UPDATED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_RISK_MATERIALIZED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_RISK_CLOSED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_RISK_REOPENED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_ISSUE_CREATED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_ISSUE_UPDATED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_ISSUE_RESOLVED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_ISSUE_CLOSED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_ISSUE_REOPENED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_DECISION_RECORDED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_DECISION_SUPERSEDED';

CREATE TABLE "ProjectGovernanceItem" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "ownerUserId" TEXT,
  "createdById" TEXT,
  "updatedById" TEXT,
  "decidedById" TEXT,
  "sourceRiskId" TEXT,
  "supersedesDecisionId" TEXT,
  "referenceNumber" TEXT NOT NULL,
  "kind" "ProjectGovernanceKind" NOT NULL,
  "status" "ProjectGovernanceStatus" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "probability" "ProjectGovernanceLevel",
  "impact" "ProjectGovernanceLevel",
  "severity" "ProjectGovernanceLevel",
  "responsePlan" TEXT,
  "contingencyPlan" TEXT,
  "trigger" TEXT,
  "resolution" TEXT,
  "closureNote" TEXT,
  "decision" TEXT,
  "rationale" TEXT,
  "alternatives" TEXT,
  "impactSummary" TEXT,
  "dueDate" TIMESTAMP(3),
  "decidedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProjectGovernanceItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectGovernanceItem_kind_status_check" CHECK (
    ("kind" = 'RISK' AND "status" IN ('OPEN', 'MONITORING', 'MITIGATED', 'MATERIALIZED', 'CLOSED')) OR
    ("kind" = 'ISSUE' AND "status" IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')) OR
    ("kind" = 'DECISION' AND "status" IN ('RECORDED', 'SUPERSEDED'))
  ),
  CONSTRAINT "ProjectGovernanceItem_kind_fields_check" CHECK (
    (
      "kind" = 'RISK' AND
      "probability" IS NOT NULL AND
      "impact" IS NOT NULL AND
      "severity" IS NULL AND
      "decision" IS NULL AND
      "rationale" IS NULL AND
      "sourceRiskId" IS NULL AND
      "supersedesDecisionId" IS NULL
    ) OR (
      "kind" = 'ISSUE' AND
      "severity" IS NOT NULL AND
      "probability" IS NULL AND
      "impact" IS NULL AND
      "decision" IS NULL AND
      "rationale" IS NULL AND
      "supersedesDecisionId" IS NULL
    ) OR (
      "kind" = 'DECISION' AND
      "decision" IS NOT NULL AND
      "rationale" IS NOT NULL AND
      "decidedAt" IS NOT NULL AND
      "decidedById" IS NOT NULL AND
      "probability" IS NULL AND
      "impact" IS NULL AND
      "severity" IS NULL AND
      "sourceRiskId" IS NULL
    )
  ),
  CONSTRAINT "ProjectGovernanceItem_resolution_check" CHECK (
    "kind" <> 'ISSUE' OR
    "status" NOT IN ('RESOLVED', 'CLOSED') OR
    NULLIF(BTRIM("resolution"), '') IS NOT NULL
  ),
  CONSTRAINT "ProjectGovernanceItem_closed_note_check" CHECK (
    "status" <> 'CLOSED' OR NULLIF(BTRIM("closureNote"), '') IS NOT NULL
  )
);

CREATE UNIQUE INDEX "ProjectGovernanceItem_sourceRiskId_key"
  ON "ProjectGovernanceItem"("sourceRiskId");
CREATE UNIQUE INDEX "ProjectGovernanceItem_supersedesDecisionId_key"
  ON "ProjectGovernanceItem"("supersedesDecisionId");
CREATE UNIQUE INDEX "ProjectGovernanceItem_companyId_referenceNumber_key"
  ON "ProjectGovernanceItem"("companyId", "referenceNumber");
CREATE INDEX "ProjectGovernanceItem_companyId_idx" ON "ProjectGovernanceItem"("companyId");
CREATE INDEX "ProjectGovernanceItem_projectId_idx" ON "ProjectGovernanceItem"("projectId");
CREATE INDEX "ProjectGovernanceItem_kind_idx" ON "ProjectGovernanceItem"("kind");
CREATE INDEX "ProjectGovernanceItem_status_idx" ON "ProjectGovernanceItem"("status");
CREATE INDEX "ProjectGovernanceItem_ownerUserId_idx" ON "ProjectGovernanceItem"("ownerUserId");
CREATE INDEX "ProjectGovernanceItem_createdById_idx" ON "ProjectGovernanceItem"("createdById");
CREATE INDEX "ProjectGovernanceItem_updatedById_idx" ON "ProjectGovernanceItem"("updatedById");
CREATE INDEX "ProjectGovernanceItem_decidedById_idx" ON "ProjectGovernanceItem"("decidedById");
CREATE INDEX "ProjectGovernanceItem_dueDate_idx" ON "ProjectGovernanceItem"("dueDate");
CREATE INDEX "ProjectGovernanceItem_createdAt_idx" ON "ProjectGovernanceItem"("createdAt");

ALTER TABLE "ProjectGovernanceItem"
  ADD CONSTRAINT "ProjectGovernanceItem_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectGovernanceItem"
  ADD CONSTRAINT "ProjectGovernanceItem_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectGovernanceItem"
  ADD CONSTRAINT "ProjectGovernanceItem_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectGovernanceItem"
  ADD CONSTRAINT "ProjectGovernanceItem_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectGovernanceItem"
  ADD CONSTRAINT "ProjectGovernanceItem_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectGovernanceItem"
  ADD CONSTRAINT "ProjectGovernanceItem_decidedById_fkey"
  FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectGovernanceItem"
  ADD CONSTRAINT "ProjectGovernanceItem_sourceRiskId_fkey"
  FOREIGN KEY ("sourceRiskId") REFERENCES "ProjectGovernanceItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectGovernanceItem"
  ADD CONSTRAINT "ProjectGovernanceItem_supersedesDecisionId_fkey"
  FOREIGN KEY ("supersedesDecisionId") REFERENCES "ProjectGovernanceItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
