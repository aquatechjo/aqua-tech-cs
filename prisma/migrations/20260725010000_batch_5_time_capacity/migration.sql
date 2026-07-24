-- Batch 5: time tracking, weekly timesheets, approval controls,
-- employee capacity, and project effort economics.

CREATE TYPE "TimesheetStatus" AS ENUM (
  'OPEN',
  'SUBMITTED',
  'APPROVED',
  'REJECTED'
);

ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'TIME_ENTRY_CREATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'TIME_ENTRY_UPDATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'TIME_ENTRY_DELETED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'TIME_TIMER_STARTED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'TIME_TIMER_STOPPED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'TIMESHEET_SUBMITTED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'TIMESHEET_APPROVED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'TIMESHEET_REJECTED';

ALTER TABLE "EmployeeProfile"
  ADD COLUMN "hourlyCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "billableRate" DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE "EmployeeProfile"
  ADD CONSTRAINT "EmployeeProfile_hourlyCost_check" CHECK ("hourlyCost" >= 0),
  ADD CONSTRAINT "EmployeeProfile_billableRate_check" CHECK ("billableRate" >= 0);

CREATE TABLE "Timesheet" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "approvedById" TEXT,
  "weekStart" TIMESTAMP(3) NOT NULL,
  "status" "TimesheetStatus" NOT NULL DEFAULT 'OPEN',
  "submittedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Timesheet_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Timesheet_week_start_check" CHECK (
    "weekStart" = date_trunc('day', "weekStart")
    AND EXTRACT(ISODOW FROM "weekStart") = 1
  ),
  CONSTRAINT "Timesheet_state_check" CHECK (
    ("status" = 'OPEN' AND "submittedAt" IS NULL AND "approvedAt" IS NULL AND "approvedById" IS NULL AND "rejectedAt" IS NULL AND "rejectionReason" IS NULL) OR
    ("status" = 'SUBMITTED' AND "submittedAt" IS NOT NULL AND "approvedAt" IS NULL AND "approvedById" IS NULL AND "rejectedAt" IS NULL AND "rejectionReason" IS NULL) OR
    ("status" = 'APPROVED' AND "submittedAt" IS NOT NULL AND "approvedAt" IS NOT NULL AND "approvedById" IS NOT NULL AND "rejectedAt" IS NULL AND "rejectionReason" IS NULL) OR
    ("status" = 'REJECTED' AND "submittedAt" IS NOT NULL AND "approvedAt" IS NULL AND "approvedById" IS NULL AND "rejectedAt" IS NOT NULL AND "rejectionReason" IS NOT NULL)
  )
);

CREATE TABLE "TimeEntry" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "timesheetId" TEXT NOT NULL,
  "projectId" TEXT,
  "taskId" TEXT,
  "workDate" TIMESTAMP(3) NOT NULL,
  "description" TEXT,
  "durationMinutes" INTEGER NOT NULL DEFAULT 0,
  "billable" BOOLEAN NOT NULL DEFAULT true,
  "hourlyCostSnapshot" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "billableRateSnapshot" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TimeEntry_duration_check" CHECK ("durationMinutes" >= 0 AND "durationMinutes" <= 10080),
  CONSTRAINT "TimeEntry_rates_check" CHECK ("hourlyCostSnapshot" >= 0 AND "billableRateSnapshot" >= 0),
  CONSTRAINT "TimeEntry_state_check" CHECK (
    ("startedAt" IS NULL AND "endedAt" IS NULL AND "durationMinutes" > 0) OR
    ("startedAt" IS NOT NULL AND "endedAt" IS NULL AND "durationMinutes" = 0) OR
    ("startedAt" IS NOT NULL AND "endedAt" IS NOT NULL AND "endedAt" > "startedAt" AND "durationMinutes" > 0)
  )
);

CREATE UNIQUE INDEX "Timesheet_companyId_userId_weekStart_key"
  ON "Timesheet"("companyId", "userId", "weekStart");
CREATE INDEX "Timesheet_companyId_idx" ON "Timesheet"("companyId");
CREATE INDEX "Timesheet_userId_idx" ON "Timesheet"("userId");
CREATE INDEX "Timesheet_approvedById_idx" ON "Timesheet"("approvedById");
CREATE INDEX "Timesheet_weekStart_idx" ON "Timesheet"("weekStart");
CREATE INDEX "Timesheet_status_idx" ON "Timesheet"("status");

CREATE INDEX "TimeEntry_companyId_idx" ON "TimeEntry"("companyId");
CREATE INDEX "TimeEntry_userId_idx" ON "TimeEntry"("userId");
CREATE INDEX "TimeEntry_timesheetId_idx" ON "TimeEntry"("timesheetId");
CREATE INDEX "TimeEntry_projectId_idx" ON "TimeEntry"("projectId");
CREATE INDEX "TimeEntry_taskId_idx" ON "TimeEntry"("taskId");
CREATE INDEX "TimeEntry_workDate_idx" ON "TimeEntry"("workDate");
CREATE INDEX "TimeEntry_billable_idx" ON "TimeEntry"("billable");
CREATE INDEX "TimeEntry_startedAt_idx" ON "TimeEntry"("startedAt");

CREATE UNIQUE INDEX "TimeEntry_one_running_timer_per_user"
  ON "TimeEntry"("companyId", "userId")
  WHERE "startedAt" IS NOT NULL AND "endedAt" IS NULL;

ALTER TABLE "Timesheet"
  ADD CONSTRAINT "Timesheet_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Timesheet"
  ADD CONSTRAINT "Timesheet_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Timesheet"
  ADD CONSTRAINT "Timesheet_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TimeEntry"
  ADD CONSTRAINT "TimeEntry_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimeEntry"
  ADD CONSTRAINT "TimeEntry_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimeEntry"
  ADD CONSTRAINT "TimeEntry_timesheetId_fkey"
  FOREIGN KEY ("timesheetId") REFERENCES "Timesheet"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimeEntry"
  ADD CONSTRAINT "TimeEntry_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimeEntry"
  ADD CONSTRAINT "TimeEntry_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
