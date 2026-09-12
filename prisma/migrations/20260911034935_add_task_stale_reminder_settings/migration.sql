-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityAction" ADD VALUE 'TASK_STALE_REMINDER_SENT';
ALTER TYPE "ActivityAction" ADD VALUE 'TASK_STALE_REMINDER_FAILED';
ALTER TYPE "ActivityAction" ADD VALUE 'TASK_STALE_ESCALATED';

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "taskStaleEscalationDays" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "taskStaleReminderDays" INTEGER NOT NULL DEFAULT 5;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "staleEscalatedAt" TIMESTAMP(3),
ADD COLUMN     "staleReminderCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "staleReminderSentAt" TIMESTAMP(3),
ADD COLUMN     "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Task_companyId_status_statusChangedAt_idx" ON "Task"("companyId", "status", "statusChangedAt");
