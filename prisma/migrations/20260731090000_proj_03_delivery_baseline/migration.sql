CREATE TYPE "ProjectDeliverableStatus" AS ENUM (
  'PLANNED',
  'IN_PROGRESS',
  'READY_FOR_REVIEW',
  'CHANGES_REQUESTED',
  'ACCEPTED',
  'CANCELLED'
);

CREATE TYPE "ProjectDeliverableSource" AS ENUM (
  'ACCEPTED_PROPOSAL',
  'MANUAL'
);

ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_DELIVERABLE_CREATED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_DELIVERABLE_UPDATED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_DELIVERABLE_STATUS_CHANGED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_DELIVERABLE_REMOVED';

CREATE TABLE "ProjectDeliverable" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "phaseId" TEXT,
  "createdById" TEXT,
  "updatedById" TEXT,
  "decidedById" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "acceptanceCriteria" TEXT,
  "status" "ProjectDeliverableStatus" NOT NULL DEFAULT 'PLANNED',
  "source" "ProjectDeliverableSource" NOT NULL DEFAULT 'MANUAL',
  "sourceRef" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "dueDate" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "decidedAt" TIMESTAMP(3),
  "reviewNotes" TEXT,
  "acceptanceReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProjectDeliverable_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectDeliverable_sort_order_check"
    CHECK ("sortOrder" >= 0),
  CONSTRAINT "ProjectDeliverable_review_check"
    CHECK (
      "status" NOT IN ('CHANGES_REQUESTED', 'CANCELLED')
      OR (
        "decidedAt" IS NOT NULL
        AND "decidedById" IS NOT NULL
        AND length(btrim(COALESCE("reviewNotes", ''))) >= 3
      )
    ),
  CONSTRAINT "ProjectDeliverable_acceptance_check"
    CHECK (
      "status" <> 'ACCEPTED'
      OR (
        "decidedAt" IS NOT NULL
        AND "decidedById" IS NOT NULL
        AND length(btrim(COALESCE("acceptanceReference", ''))) >= 3
      )
    ),
  CONSTRAINT "ProjectDeliverable_submission_check"
    CHECK (
      "status" NOT IN ('READY_FOR_REVIEW', 'CHANGES_REQUESTED', 'ACCEPTED')
      OR "submittedAt" IS NOT NULL
    )
);

CREATE UNIQUE INDEX "ProjectDeliverable_projectId_sourceRef_key"
  ON "ProjectDeliverable"("projectId", "sourceRef");
CREATE INDEX "ProjectDeliverable_companyId_idx"
  ON "ProjectDeliverable"("companyId");
CREATE INDEX "ProjectDeliverable_projectId_idx"
  ON "ProjectDeliverable"("projectId");
CREATE INDEX "ProjectDeliverable_phaseId_idx"
  ON "ProjectDeliverable"("phaseId");
CREATE INDEX "ProjectDeliverable_status_idx"
  ON "ProjectDeliverable"("status");
CREATE INDEX "ProjectDeliverable_source_idx"
  ON "ProjectDeliverable"("source");
CREATE INDEX "ProjectDeliverable_dueDate_idx"
  ON "ProjectDeliverable"("dueDate");
CREATE INDEX "ProjectDeliverable_createdById_idx"
  ON "ProjectDeliverable"("createdById");
CREATE INDEX "ProjectDeliverable_updatedById_idx"
  ON "ProjectDeliverable"("updatedById");
CREATE INDEX "ProjectDeliverable_decidedById_idx"
  ON "ProjectDeliverable"("decidedById");
CREATE INDEX "ProjectDeliverable_sortOrder_idx"
  ON "ProjectDeliverable"("sortOrder");

ALTER TABLE "ProjectDeliverable"
  ADD CONSTRAINT "ProjectDeliverable_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectDeliverable"
  ADD CONSTRAINT "ProjectDeliverable_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectDeliverable"
  ADD CONSTRAINT "ProjectDeliverable_phaseId_fkey"
  FOREIGN KEY ("phaseId") REFERENCES "ProjectPhase"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectDeliverable"
  ADD CONSTRAINT "ProjectDeliverable_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectDeliverable"
  ADD CONSTRAINT "ProjectDeliverable_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectDeliverable"
  ADD CONSTRAINT "ProjectDeliverable_decidedById_fkey"
  FOREIGN KEY ("decidedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "ProjectDeliverable" (
  "id",
  "companyId",
  "projectId",
  "title",
  "description",
  "status",
  "source",
  "sourceRef",
  "sortOrder",
  "createdAt",
  "updatedAt"
)
SELECT
  concat(
    'dlv_',
    md5(
      project."id" || ':' ||
      COALESCE(item.value->>'id', item.position::text)
    )
  ),
  project."companyId",
  project."id",
  btrim(item.value->>'title'),
  NULLIF(btrim(COALESCE(item.value->>'description', '')), ''),
  'PLANNED'::"ProjectDeliverableStatus",
  'ACCEPTED_PROPOSAL'::"ProjectDeliverableSource",
  concat(
    'proposal:',
    project."originProposalWorkspaceId",
    ':v',
    project."originProposalVersion"::text,
    ':item:',
    COALESCE(item.value->>'id', item.position::text)
  ),
  row_number() OVER (
    PARTITION BY project."id"
    ORDER BY item.position
  )::integer - 1,
  project."createdAt",
  project."updatedAt"
FROM "Project" AS project
JOIN "ProposalVersion" AS proposal_version
  ON proposal_version."workspaceId" = project."originProposalWorkspaceId"
  AND proposal_version."version" = project."originProposalVersion"
CROSS JOIN LATERAL jsonb_array_elements(
  COALESCE(
    proposal_version."content"->'commercial'->'items',
    '[]'::jsonb
  )
) WITH ORDINALITY AS item(value, position)
WHERE project."originProposalWorkspaceId" IS NOT NULL
  AND project."originProposalVersion" IS NOT NULL
  AND item.value->>'kind' = 'DELIVERABLE'
  AND length(btrim(COALESCE(item.value->>'title', ''))) >= 3
ON CONFLICT ("projectId", "sourceRef") DO NOTHING;
