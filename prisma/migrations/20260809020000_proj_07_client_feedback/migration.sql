-- PROJ-07 — client feedback and governed follow-up
CREATE TYPE "ProjectFeedbackStatus" AS ENUM ('PENDING', 'RECEIVED', 'ACTION_REQUIRED', 'RESOLVED', 'WAIVED');

ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_FEEDBACK_RECORDED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_FEEDBACK_RESOLVED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_FEEDBACK_WAIVED';

CREATE TABLE "ProjectFeedback" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "ownerId" TEXT,
  "recordedById" TEXT,
  "resolvedById" TEXT,
  "status" "ProjectFeedbackStatus" NOT NULL DEFAULT 'PENDING',
  "npsScore" INTEGER,
  "satisfactionScore" INTEGER,
  "feedbackSummary" TEXT,
  "improvementNotes" TEXT,
  "testimonial" TEXT,
  "testimonialApproved" BOOLEAN NOT NULL DEFAULT false,
  "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
  "followUpAction" TEXT,
  "followUpDueAt" TIMESTAMP(3),
  "resolutionNote" TEXT,
  "receivedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "waivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectFeedback_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectFeedback_scores_check" CHECK (("npsScore" IS NULL OR "npsScore" BETWEEN 0 AND 10) AND ("satisfactionScore" IS NULL OR "satisfactionScore" BETWEEN 1 AND 5)),
  CONSTRAINT "ProjectFeedback_received_check" CHECK ("status" = 'PENDING' OR ("npsScore" IS NOT NULL AND "satisfactionScore" IS NOT NULL AND NULLIF(BTRIM("feedbackSummary"), '') IS NOT NULL AND "receivedAt" IS NOT NULL)),
  CONSTRAINT "ProjectFeedback_testimonial_check" CHECK (NOT "testimonialApproved" OR NULLIF(BTRIM("testimonial"), '') IS NOT NULL),
  CONSTRAINT "ProjectFeedback_follow_up_check" CHECK (NOT "followUpRequired" OR (NULLIF(BTRIM("followUpAction"), '') IS NOT NULL AND "followUpDueAt" IS NOT NULL AND "ownerId" IS NOT NULL)),
  CONSTRAINT "ProjectFeedback_resolution_check" CHECK ("status" NOT IN ('RESOLVED', 'WAIVED') OR NULLIF(BTRIM("resolutionNote"), '') IS NOT NULL)
);

CREATE UNIQUE INDEX "ProjectFeedback_projectId_key" ON "ProjectFeedback"("projectId");
CREATE INDEX "ProjectFeedback_companyId_idx" ON "ProjectFeedback"("companyId");
CREATE INDEX "ProjectFeedback_status_idx" ON "ProjectFeedback"("status");
CREATE INDEX "ProjectFeedback_ownerId_idx" ON "ProjectFeedback"("ownerId");
CREATE INDEX "ProjectFeedback_followUpDueAt_idx" ON "ProjectFeedback"("followUpDueAt");
ALTER TABLE "ProjectFeedback" ADD CONSTRAINT "ProjectFeedback_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectFeedback" ADD CONSTRAINT "ProjectFeedback_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectFeedback" ADD CONSTRAINT "ProjectFeedback_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectFeedback" ADD CONSTRAINT "ProjectFeedback_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectFeedback" ADD CONSTRAINT "ProjectFeedback_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
