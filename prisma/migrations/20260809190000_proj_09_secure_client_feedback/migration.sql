ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_FEEDBACK_LINK_ISSUED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_FEEDBACK_LINK_REVOKED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_FEEDBACK_LINK_VIEWED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_FEEDBACK_CLIENT_SUBMITTED';

ALTER TABLE "ProjectFeedback"
ADD COLUMN "publicTokenHash" TEXT,
ADD COLUMN "publicExpiresAt" TIMESTAMP(3),
ADD COLUMN "publicRevokedAt" TIMESTAMP(3),
ADD COLUMN "publicIssuedAt" TIMESTAMP(3),
ADD COLUMN "publicFirstViewedAt" TIMESTAMP(3),
ADD COLUMN "publicLastViewedAt" TIMESTAMP(3),
ADD COLUMN "publicViewCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "publicSubmittedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "ProjectFeedback_publicTokenHash_key" ON "ProjectFeedback"("publicTokenHash");
CREATE INDEX "ProjectFeedback_publicExpiresAt_idx" ON "ProjectFeedback"("publicExpiresAt");

ALTER TABLE "ProjectFeedback" ADD CONSTRAINT "ProjectFeedback_public_access_check" CHECK (
  ("publicTokenHash" IS NULL AND "publicExpiresAt" IS NULL)
  OR ("publicTokenHash" IS NOT NULL AND "publicExpiresAt" IS NOT NULL AND "publicRevokedAt" IS NULL AND "publicSubmittedAt" IS NULL)
);
