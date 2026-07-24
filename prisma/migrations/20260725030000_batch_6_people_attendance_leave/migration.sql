-- Batch 6: work schedules, attendance, leave policies and balances,
-- approval workflows, and company holidays.

CREATE TYPE "AttendanceStatus" AS ENUM (
  'PRESENT',
  'LATE',
  'ABSENT',
  'REMOTE',
  'HALF_DAY',
  'ON_LEAVE',
  'HOLIDAY'
);

CREATE TYPE "AttendanceSource" AS ENUM (
  'SELF_SERVICE',
  'MANUAL',
  'SYSTEM'
);

CREATE TYPE "LeaveRequestStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED'
);

CREATE TYPE "LeaveDayPortion" AS ENUM (
  'FULL_DAY',
  'FIRST_HALF',
  'SECOND_HALF'
);

ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'WORK_SCHEDULE_CREATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'WORK_SCHEDULE_UPDATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'ATTENDANCE_CHECKED_IN';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'ATTENDANCE_CHECKED_OUT';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'ATTENDANCE_UPDATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'LEAVE_TYPE_CREATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'LEAVE_TYPE_UPDATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'LEAVE_BALANCE_ADJUSTED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'LEAVE_REQUEST_SUBMITTED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'LEAVE_REQUEST_APPROVED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'LEAVE_REQUEST_REJECTED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'LEAVE_REQUEST_CANCELLED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'HOLIDAY_CREATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'HOLIDAY_UPDATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'HOLIDAY_DELETED';

CREATE TABLE "WorkSchedule" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "workingDays" INTEGER[] NOT NULL,
  "startMinute" INTEGER NOT NULL DEFAULT 540,
  "endMinute" INTEGER NOT NULL DEFAULT 1020,
  "breakMinutes" INTEGER NOT NULL DEFAULT 60,
  "graceMinutes" INTEGER NOT NULL DEFAULT 15,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkSchedule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkSchedule_days_check" CHECK (
    cardinality("workingDays") > 0
    AND "workingDays" <@ ARRAY[1,2,3,4,5,6,7]
  ),
  CONSTRAINT "WorkSchedule_minutes_check" CHECK (
    "startMinute" >= 0 AND "startMinute" < 1440
    AND "endMinute" > "startMinute" AND "endMinute" <= 1440
    AND "breakMinutes" >= 0
    AND "breakMinutes" < ("endMinute" - "startMinute")
    AND "graceMinutes" >= 0 AND "graceMinutes" <= 180
  )
);

CREATE TABLE "AttendanceRecord" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "updatedById" TEXT,
  "workScheduleId" TEXT,
  "workDate" TIMESTAMP(3) NOT NULL,
  "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
  "source" "AttendanceSource" NOT NULL DEFAULT 'SELF_SERVICE',
  "checkInAt" TIMESTAMP(3),
  "checkOutAt" TIMESTAMP(3),
  "scheduledStartMinute" INTEGER,
  "scheduledEndMinute" INTEGER,
  "breakMinutes" INTEGER NOT NULL DEFAULT 0,
  "graceMinutes" INTEGER NOT NULL DEFAULT 0,
  "workedMinutes" INTEGER NOT NULL DEFAULT 0,
  "lateMinutes" INTEGER NOT NULL DEFAULT 0,
  "overtimeMinutes" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttendanceRecord_date_check" CHECK ("workDate" = date_trunc('day', "workDate")),
  CONSTRAINT "AttendanceRecord_time_order_check" CHECK (
    "checkOutAt" IS NULL OR ("checkInAt" IS NOT NULL AND "checkOutAt" > "checkInAt")
  ),
  CONSTRAINT "AttendanceRecord_minutes_check" CHECK (
    "workedMinutes" >= 0 AND "lateMinutes" >= 0 AND "overtimeMinutes" >= 0
    AND "breakMinutes" >= 0 AND "graceMinutes" >= 0
  )
);

CREATE TABLE "LeaveType" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "annualAllowanceDays" DECIMAL(6,2) NOT NULL DEFAULT 0,
  "carryoverLimitDays" DECIMAL(6,2) NOT NULL DEFAULT 0,
  "isPaid" BOOLEAN NOT NULL DEFAULT true,
  "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LeaveType_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LeaveType_allowance_check" CHECK (
    "annualAllowanceDays" >= 0 AND "annualAllowanceDays" <= 366
    AND "carryoverLimitDays" >= 0 AND "carryoverLimitDays" <= 366
  )
);

CREATE TABLE "LeaveBalance" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "leaveTypeId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "openingDays" DECIMAL(6,2) NOT NULL DEFAULT 0,
  "accruedDays" DECIMAL(6,2) NOT NULL DEFAULT 0,
  "adjustedDays" DECIMAL(6,2) NOT NULL DEFAULT 0,
  "usedDays" DECIMAL(6,2) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LeaveBalance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LeaveBalance_year_check" CHECK ("year" BETWEEN 2000 AND 2200),
  CONSTRAINT "LeaveBalance_values_check" CHECK (
    "openingDays" >= 0 AND "accruedDays" >= 0 AND "usedDays" >= 0
    AND "openingDays" <= 366 AND "accruedDays" <= 366 AND "usedDays" <= 732
    AND "adjustedDays" BETWEEN -366 AND 366
  )
);

CREATE TABLE "LeaveRequest" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "leaveTypeId" TEXT NOT NULL,
  "reviewedById" TEXT,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "startPortion" "LeaveDayPortion" NOT NULL DEFAULT 'FULL_DAY',
  "endPortion" "LeaveDayPortion" NOT NULL DEFAULT 'FULL_DAY',
  "totalDays" DECIMAL(6,2) NOT NULL,
  "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT,
  "reviewNote" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LeaveRequest_date_check" CHECK (
    "startDate" = date_trunc('day', "startDate")
    AND "endDate" = date_trunc('day', "endDate")
    AND "endDate" >= "startDate"
  ),
  CONSTRAINT "LeaveRequest_days_check" CHECK ("totalDays" > 0 AND "totalDays" <= 366),
  CONSTRAINT "LeaveRequest_state_check" CHECK (
    ("status" = 'PENDING' AND "reviewedById" IS NULL AND "reviewedAt" IS NULL AND "cancelledAt" IS NULL) OR
    ("status" = 'APPROVED' AND "reviewedById" IS NOT NULL AND "reviewedAt" IS NOT NULL AND "cancelledAt" IS NULL) OR
    ("status" = 'REJECTED' AND "reviewedById" IS NOT NULL AND "reviewedAt" IS NOT NULL AND "cancelledAt" IS NULL) OR
    ("status" = 'CANCELLED' AND "cancelledAt" IS NOT NULL)
  )
);

CREATE TABLE "PublicHoliday" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PublicHoliday_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PublicHoliday_date_check" CHECK ("date" = date_trunc('day', "date"))
);

ALTER TABLE "EmployeeProfile" ADD COLUMN "workScheduleId" TEXT;

CREATE UNIQUE INDEX "WorkSchedule_companyId_code_key" ON "WorkSchedule"("companyId", "code");
CREATE UNIQUE INDEX "WorkSchedule_one_default_per_company" ON "WorkSchedule"("companyId") WHERE "isDefault" = true;
CREATE INDEX "WorkSchedule_companyId_idx" ON "WorkSchedule"("companyId");
CREATE INDEX "WorkSchedule_isDefault_idx" ON "WorkSchedule"("isDefault");
CREATE INDEX "WorkSchedule_isActive_idx" ON "WorkSchedule"("isActive");

CREATE UNIQUE INDEX "AttendanceRecord_companyId_userId_workDate_key" ON "AttendanceRecord"("companyId", "userId", "workDate");
CREATE INDEX "AttendanceRecord_companyId_idx" ON "AttendanceRecord"("companyId");
CREATE INDEX "AttendanceRecord_userId_idx" ON "AttendanceRecord"("userId");
CREATE INDEX "AttendanceRecord_updatedById_idx" ON "AttendanceRecord"("updatedById");
CREATE INDEX "AttendanceRecord_workScheduleId_idx" ON "AttendanceRecord"("workScheduleId");
CREATE INDEX "AttendanceRecord_workDate_idx" ON "AttendanceRecord"("workDate");
CREATE INDEX "AttendanceRecord_status_idx" ON "AttendanceRecord"("status");

CREATE UNIQUE INDEX "LeaveType_companyId_code_key" ON "LeaveType"("companyId", "code");
CREATE INDEX "LeaveType_companyId_idx" ON "LeaveType"("companyId");
CREATE INDEX "LeaveType_isActive_idx" ON "LeaveType"("isActive");

CREATE UNIQUE INDEX "LeaveBalance_companyId_userId_leaveTypeId_year_key" ON "LeaveBalance"("companyId", "userId", "leaveTypeId", "year");
CREATE INDEX "LeaveBalance_companyId_idx" ON "LeaveBalance"("companyId");
CREATE INDEX "LeaveBalance_userId_idx" ON "LeaveBalance"("userId");
CREATE INDEX "LeaveBalance_leaveTypeId_idx" ON "LeaveBalance"("leaveTypeId");
CREATE INDEX "LeaveBalance_year_idx" ON "LeaveBalance"("year");

CREATE INDEX "LeaveRequest_companyId_idx" ON "LeaveRequest"("companyId");
CREATE INDEX "LeaveRequest_userId_idx" ON "LeaveRequest"("userId");
CREATE INDEX "LeaveRequest_leaveTypeId_idx" ON "LeaveRequest"("leaveTypeId");
CREATE INDEX "LeaveRequest_reviewedById_idx" ON "LeaveRequest"("reviewedById");
CREATE INDEX "LeaveRequest_startDate_idx" ON "LeaveRequest"("startDate");
CREATE INDEX "LeaveRequest_endDate_idx" ON "LeaveRequest"("endDate");
CREATE INDEX "LeaveRequest_status_idx" ON "LeaveRequest"("status");

CREATE UNIQUE INDEX "PublicHoliday_companyId_date_key" ON "PublicHoliday"("companyId", "date");
CREATE INDEX "PublicHoliday_companyId_idx" ON "PublicHoliday"("companyId");
CREATE INDEX "PublicHoliday_date_idx" ON "PublicHoliday"("date");
CREATE INDEX "EmployeeProfile_workScheduleId_idx" ON "EmployeeProfile"("workScheduleId");

ALTER TABLE "WorkSchedule"
  ADD CONSTRAINT "WorkSchedule_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AttendanceRecord"
  ADD CONSTRAINT "AttendanceRecord_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceRecord"
  ADD CONSTRAINT "AttendanceRecord_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceRecord"
  ADD CONSTRAINT "AttendanceRecord_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AttendanceRecord"
  ADD CONSTRAINT "AttendanceRecord_workScheduleId_fkey"
  FOREIGN KEY ("workScheduleId") REFERENCES "WorkSchedule"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeaveType"
  ADD CONSTRAINT "LeaveType_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeaveBalance"
  ADD CONSTRAINT "LeaveBalance_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaveBalance"
  ADD CONSTRAINT "LeaveBalance_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaveBalance"
  ADD CONSTRAINT "LeaveBalance_leaveTypeId_fkey"
  FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeaveRequest"
  ADD CONSTRAINT "LeaveRequest_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaveRequest"
  ADD CONSTRAINT "LeaveRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaveRequest"
  ADD CONSTRAINT "LeaveRequest_leaveTypeId_fkey"
  FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveRequest"
  ADD CONSTRAINT "LeaveRequest_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PublicHoliday"
  ADD CONSTRAINT "PublicHoliday_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeeProfile"
  ADD CONSTRAINT "EmployeeProfile_workScheduleId_fkey"
  FOREIGN KEY ("workScheduleId") REFERENCES "WorkSchedule"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed a safe default schedule and common leave types for existing companies.
INSERT INTO "WorkSchedule" (
  "id", "companyId", "name", "code", "description", "workingDays",
  "startMinute", "endMinute", "breakMinutes", "graceMinutes",
  "isDefault", "isActive", "updatedAt"
)
SELECT
  'ws_' || substr(md5("id" || ':default-schedule'), 1, 24),
  "id",
  'الدوام الأساسي',
  'DEFAULT',
  'الأحد إلى الخميس، 09:00 - 17:00',
  ARRAY[7,1,2,3,4],
  540,
  1020,
  60,
  15,
  true,
  true,
  CURRENT_TIMESTAMP
FROM "Company"
ON CONFLICT ("companyId", "code") DO NOTHING;

UPDATE "EmployeeProfile" AS employee
SET "workScheduleId" = schedule."id"
FROM "WorkSchedule" AS schedule
WHERE schedule."companyId" = employee."companyId"
  AND schedule."isDefault" = true
  AND employee."workScheduleId" IS NULL;

INSERT INTO "LeaveType" (
  "id", "companyId", "name", "code", "description",
  "annualAllowanceDays", "carryoverLimitDays", "isPaid",
  "requiresApproval", "isActive", "updatedAt"
)
SELECT
  'lt_' || substr(md5("id" || ':annual-leave'), 1, 24),
  "id",
  'إجازة سنوية',
  'ANNUAL',
  'الإجازة السنوية المدفوعة',
  14,
  0,
  true,
  true,
  true,
  CURRENT_TIMESTAMP
FROM "Company"
ON CONFLICT ("companyId", "code") DO NOTHING;

INSERT INTO "LeaveType" (
  "id", "companyId", "name", "code", "description",
  "annualAllowanceDays", "carryoverLimitDays", "isPaid",
  "requiresApproval", "isActive", "updatedAt"
)
SELECT
  'lt_' || substr(md5("id" || ':sick-leave'), 1, 24),
  "id",
  'إجازة مرضية',
  'SICK',
  'إجازة مرضية مدفوعة حسب سياسة الشركة',
  14,
  0,
  true,
  true,
  true,
  CURRENT_TIMESTAMP
FROM "Company"
ON CONFLICT ("companyId", "code") DO NOTHING;
