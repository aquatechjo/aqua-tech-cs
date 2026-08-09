ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_FEEDBACK_TASK_CREATED';
ALTER TYPE "TaskSource" ADD VALUE 'PROJECT_FEEDBACK';

ALTER TABLE "ProjectFeedback"
ADD COLUMN "followUpTaskId" TEXT;

CREATE UNIQUE INDEX "ProjectFeedback_followUpTaskId_key"
ON "ProjectFeedback"("followUpTaskId");

ALTER TABLE "ProjectFeedback"
ADD CONSTRAINT "ProjectFeedback_followUpTaskId_fkey"
FOREIGN KEY ("followUpTaskId") REFERENCES "Task"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
