ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_FEEDBACK_SCHEDULE_ENABLED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_FEEDBACK_SCHEDULE_DISABLED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_FEEDBACK_SCHEDULED_REMINDER_SENT';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_FEEDBACK_SCHEDULED_REMINDER_FAILED';

ALTER TABLE "ProjectFeedback"
ADD COLUMN "reminderScheduleEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "reminderNextAt" TIMESTAMP(3),
ADD COLUMN "reminderScheduleUpdatedAt" TIMESTAMP(3);

CREATE INDEX "ProjectFeedback_reminderScheduleEnabled_reminderNextAt_idx"
ON "ProjectFeedback"("reminderScheduleEnabled", "reminderNextAt");
