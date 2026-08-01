-- PROJ-04 — governed project change requests and scope application

ALTER TYPE "ProjectDeliverableSource" ADD VALUE IF NOT EXISTS 'CHANGE_REQUEST';

CREATE TYPE "ProjectChangeRequestStatus" AS ENUM (
  'DRAFT',
  'IN_REVIEW',
  'CHANGES_REQUESTED',
  'APPROVED',
  'REJECTED',
  'APPLIED',
  'CANCELLED'
);

CREATE TYPE "ProjectChangeItemAction" AS ENUM (
  'ADD_DELIVERABLE',
  'MODIFY_DELIVERABLE',
  'CANCEL_DELIVERABLE'
);

CREATE TYPE "ProjectChangeCommercialImpact" AS ENUM (
  'NONE',
  'REQUIRES_QUOTE',
  'APPROVED'
);

ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'PROJECT_CHANGE_REQUEST_CREATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'PROJECT_CHANGE_REQUEST_UPDATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'PROJECT_CHANGE_REQUEST_SUBMITTED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'PROJECT_CHANGE_REQUEST_CHANGES_REQUESTED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'PROJECT_CHANGE_REQUEST_APPROVED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'PROJECT_CHANGE_REQUEST_REJECTED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'PROJECT_CHANGE_REQUEST_APPLIED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'PROJECT_CHANGE_REQUEST_CANCELLED';

CREATE TABLE "ProjectChangeRequest" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "createdById" TEXT,
  "reviewedById" TEXT,
  "appliedById" TEXT,
  "requestNumber" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "businessReason" TEXT NOT NULL,
  "status" "ProjectChangeRequestStatus" NOT NULL DEFAULT 'DRAFT',
  "scheduleImpactDays" INTEGER NOT NULL DEFAULT 0,
  "commercialImpact" "ProjectChangeCommercialImpact" NOT NULL DEFAULT 'NONE',
  "commercialReference" TEXT,
  "clientApprovalRequired" BOOLEAN NOT NULL DEFAULT true,
  "clientApprovalReference" TEXT,
  "reviewNotes" TEXT,
  "submittedAt" TIMESTAMP(3),
  "changesRequestedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "appliedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProjectChangeRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectChangeRequest_schedule_impact_check"
    CHECK ("scheduleImpactDays" BETWEEN -3650 AND 3650),
  CONSTRAINT "ProjectChangeRequest_title_check"
    CHECK (length(btrim("title")) BETWEEN 3 AND 300),
  CONSTRAINT "ProjectChangeRequest_reason_check"
    CHECK (length(btrim("businessReason")) BETWEEN 3 AND 4000),
  CONSTRAINT "ProjectChangeRequest_commercial_reference_check"
    CHECK (
      "commercialImpact" <> 'APPROVED'
      OR length(btrim(COALESCE("commercialReference", ''))) >= 3
    ),
  CONSTRAINT "ProjectChangeRequest_client_approval_check"
    CHECK (
      "status" NOT IN ('APPROVED', 'APPLIED')
      OR NOT "clientApprovalRequired"
      OR length(btrim(COALESCE("clientApprovalReference", ''))) >= 3
    ),
  CONSTRAINT "ProjectChangeRequest_pricing_ready_check"
    CHECK (
      "status" NOT IN ('APPROVED', 'APPLIED')
      OR "commercialImpact" <> 'REQUIRES_QUOTE'
    ),
  CONSTRAINT "ProjectChangeRequest_submission_state_check"
    CHECK (
      "status" NOT IN (
        'IN_REVIEW',
        'CHANGES_REQUESTED',
        'APPROVED',
        'REJECTED',
        'APPLIED'
      )
      OR "submittedAt" IS NOT NULL
    ),
  CONSTRAINT "ProjectChangeRequest_changes_state_check"
    CHECK (
      "status" <> 'CHANGES_REQUESTED'
      OR (
        "changesRequestedAt" IS NOT NULL
        AND "reviewedById" IS NOT NULL
        AND length(btrim(COALESCE("reviewNotes", ''))) >= 3
      )
    ),
  CONSTRAINT "ProjectChangeRequest_approval_state_check"
    CHECK (
      "status" NOT IN ('APPROVED', 'APPLIED')
      OR ("approvedAt" IS NOT NULL AND "reviewedById" IS NOT NULL)
    ),
  CONSTRAINT "ProjectChangeRequest_rejection_state_check"
    CHECK (
      "status" <> 'REJECTED'
      OR (
        "rejectedAt" IS NOT NULL
        AND "reviewedById" IS NOT NULL
        AND length(btrim(COALESCE("reviewNotes", ''))) >= 3
      )
    ),
  CONSTRAINT "ProjectChangeRequest_application_state_check"
    CHECK (
      "status" <> 'APPLIED'
      OR ("appliedAt" IS NOT NULL AND "appliedById" IS NOT NULL)
    ),
  CONSTRAINT "ProjectChangeRequest_cancellation_state_check"
    CHECK (
      "status" <> 'CANCELLED'
      OR (
        "cancelledAt" IS NOT NULL
        AND length(btrim(COALESCE("reviewNotes", ''))) >= 3
      )
    )
);

CREATE TABLE "ProjectChangeRequestItem" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "changeRequestId" TEXT NOT NULL,
  "targetDeliverableId" TEXT,
  "targetUpdatedAt" TIMESTAMP(3),
  "resultDeliverableId" TEXT,
  "phaseId" TEXT,
  "action" "ProjectChangeItemAction" NOT NULL,
  "title" TEXT,
  "description" TEXT,
  "acceptanceCriteria" TEXT,
  "reason" TEXT,
  "dueDate" TIMESTAMP(3),
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProjectChangeRequestItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectChangeRequestItem_sort_order_check"
    CHECK ("sortOrder" BETWEEN 0 AND 10000),
  CONSTRAINT "ProjectChangeRequestItem_shape_check"
    CHECK (
      (
        "action" = 'ADD_DELIVERABLE'
        AND "targetDeliverableId" IS NULL
        AND "targetUpdatedAt" IS NULL
        AND length(btrim(COALESCE("title", ''))) BETWEEN 3 AND 300
        AND "reason" IS NULL
      )
      OR
      (
        "action" = 'MODIFY_DELIVERABLE'
        AND "targetDeliverableId" IS NOT NULL
        AND "targetUpdatedAt" IS NOT NULL
        AND length(btrim(COALESCE("title", ''))) BETWEEN 3 AND 300
        AND "reason" IS NULL
      )
      OR
      (
        "action" = 'CANCEL_DELIVERABLE'
        AND "targetDeliverableId" IS NOT NULL
        AND "targetUpdatedAt" IS NOT NULL
        AND length(btrim(COALESCE("reason", ''))) BETWEEN 3 AND 1000
      )
    )
);

CREATE UNIQUE INDEX "ProjectChangeRequest_companyId_requestNumber_key"
  ON "ProjectChangeRequest"("companyId", "requestNumber");
CREATE INDEX "ProjectChangeRequest_companyId_idx"
  ON "ProjectChangeRequest"("companyId");
CREATE INDEX "ProjectChangeRequest_projectId_idx"
  ON "ProjectChangeRequest"("projectId");
CREATE INDEX "ProjectChangeRequest_createdById_idx"
  ON "ProjectChangeRequest"("createdById");
CREATE INDEX "ProjectChangeRequest_reviewedById_idx"
  ON "ProjectChangeRequest"("reviewedById");
CREATE INDEX "ProjectChangeRequest_appliedById_idx"
  ON "ProjectChangeRequest"("appliedById");
CREATE INDEX "ProjectChangeRequest_status_idx"
  ON "ProjectChangeRequest"("status");
CREATE INDEX "ProjectChangeRequest_submittedAt_idx"
  ON "ProjectChangeRequest"("submittedAt");
CREATE INDEX "ProjectChangeRequest_updatedAt_idx"
  ON "ProjectChangeRequest"("updatedAt");

CREATE INDEX "ProjectChangeRequestItem_companyId_idx"
  ON "ProjectChangeRequestItem"("companyId");
CREATE INDEX "ProjectChangeRequestItem_projectId_idx"
  ON "ProjectChangeRequestItem"("projectId");
CREATE INDEX "ProjectChangeRequestItem_changeRequestId_idx"
  ON "ProjectChangeRequestItem"("changeRequestId");
CREATE INDEX "ProjectChangeRequestItem_targetDeliverableId_idx"
  ON "ProjectChangeRequestItem"("targetDeliverableId");
CREATE INDEX "ProjectChangeRequestItem_resultDeliverableId_idx"
  ON "ProjectChangeRequestItem"("resultDeliverableId");
CREATE INDEX "ProjectChangeRequestItem_phaseId_idx"
  ON "ProjectChangeRequestItem"("phaseId");
CREATE INDEX "ProjectChangeRequestItem_action_idx"
  ON "ProjectChangeRequestItem"("action");
CREATE INDEX "ProjectChangeRequestItem_sortOrder_idx"
  ON "ProjectChangeRequestItem"("sortOrder");

ALTER TABLE "ProjectChangeRequest"
  ADD CONSTRAINT "ProjectChangeRequest_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectChangeRequest"
  ADD CONSTRAINT "ProjectChangeRequest_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectChangeRequest"
  ADD CONSTRAINT "ProjectChangeRequest_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectChangeRequest"
  ADD CONSTRAINT "ProjectChangeRequest_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectChangeRequest"
  ADD CONSTRAINT "ProjectChangeRequest_appliedById_fkey"
  FOREIGN KEY ("appliedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectChangeRequestItem"
  ADD CONSTRAINT "ProjectChangeRequestItem_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectChangeRequestItem"
  ADD CONSTRAINT "ProjectChangeRequestItem_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectChangeRequestItem"
  ADD CONSTRAINT "ProjectChangeRequestItem_changeRequestId_fkey"
  FOREIGN KEY ("changeRequestId") REFERENCES "ProjectChangeRequest"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectChangeRequestItem"
  ADD CONSTRAINT "ProjectChangeRequestItem_targetDeliverableId_fkey"
  FOREIGN KEY ("targetDeliverableId") REFERENCES "ProjectDeliverable"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectChangeRequestItem"
  ADD CONSTRAINT "ProjectChangeRequestItem_resultDeliverableId_fkey"
  FOREIGN KEY ("resultDeliverableId") REFERENCES "ProjectDeliverable"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectChangeRequestItem"
  ADD CONSTRAINT "ProjectChangeRequestItem_phaseId_fkey"
  FOREIGN KEY ("phaseId") REFERENCES "ProjectPhase"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
