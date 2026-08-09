-- PROJ-06 — governed project closure and post-project review
CREATE TYPE "ProjectClosureStatus" AS ENUM ('DRAFT', 'READY_FOR_REVIEW', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "ProjectClosureOutcome" AS ENUM ('SUCCESS', 'PARTIAL_SUCCESS', 'CANCELLED');

ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_CLOSURE_UPDATED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_CLOSURE_SUBMITTED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_CLOSURE_COMPLETED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_CLOSURE_ARCHIVED';

CREATE TABLE "ProjectClosure" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "preparedById" TEXT,
  "approvedById" TEXT,
  "status" "ProjectClosureStatus" NOT NULL DEFAULT 'DRAFT',
  "outcome" "ProjectClosureOutcome",
  "summary" TEXT,
  "lessonsLearned" TEXT,
  "followUpActions" TEXT,
  "clientHandoverRef" TEXT,
  "internalArchiveRef" TEXT,
  "exceptionReason" TEXT,
  "submittedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectClosure_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectClosure_evidence_check" CHECK (
    "status" = 'DRAFT' OR (
      NULLIF(BTRIM("summary"), '') IS NOT NULL AND
      NULLIF(BTRIM("lessonsLearned"), '') IS NOT NULL AND
      NULLIF(BTRIM("clientHandoverRef"), '') IS NOT NULL AND
      NULLIF(BTRIM("internalArchiveRef"), '') IS NOT NULL AND
      "outcome" IS NOT NULL
    )
  ),
  CONSTRAINT "ProjectClosure_completed_check" CHECK (
    "status" NOT IN ('COMPLETED', 'ARCHIVED') OR "completedAt" IS NOT NULL
  ),
  CONSTRAINT "ProjectClosure_archived_check" CHECK (
    "status" <> 'ARCHIVED' OR "archivedAt" IS NOT NULL
  )
);

CREATE UNIQUE INDEX "ProjectClosure_projectId_key" ON "ProjectClosure"("projectId");
CREATE INDEX "ProjectClosure_companyId_idx" ON "ProjectClosure"("companyId");
CREATE INDEX "ProjectClosure_status_idx" ON "ProjectClosure"("status");
CREATE INDEX "ProjectClosure_preparedById_idx" ON "ProjectClosure"("preparedById");
CREATE INDEX "ProjectClosure_approvedById_idx" ON "ProjectClosure"("approvedById");
ALTER TABLE "ProjectClosure" ADD CONSTRAINT "ProjectClosure_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectClosure" ADD CONSTRAINT "ProjectClosure_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectClosure" ADD CONSTRAINT "ProjectClosure_preparedById_fkey" FOREIGN KEY ("preparedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectClosure" ADD CONSTRAINT "ProjectClosure_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
