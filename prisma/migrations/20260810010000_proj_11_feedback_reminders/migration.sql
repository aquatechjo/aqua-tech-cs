ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_FEEDBACK_REMINDER_SENT';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_FEEDBACK_REMINDER_FAILED';

ALTER TABLE "ProjectFeedback"
ADD COLUMN "reminderProviderId" TEXT,
ADD COLUMN "reminderPreparedAt" TIMESTAMP(3),
ADD COLUMN "reminderSentAt" TIMESTAMP(3),
ADD COLUMN "reminderFailedAt" TIMESTAMP(3),
ADD COLUMN "reminderFailureReason" TEXT,
ADD COLUMN "reminderAttemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "reminderPendingTokenHash" TEXT,
ADD COLUMN "reminderPendingExpiresAt" TIMESTAMP(3),
ADD COLUMN "reminderCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ProjectFeedback" ADD CONSTRAINT "ProjectFeedback_reminder_count_check" CHECK ("reminderCount" BETWEEN 0 AND 3);
CREATE UNIQUE INDEX "ProjectFeedback_reminderPendingTokenHash_key" ON "ProjectFeedback"("reminderPendingTokenHash");
