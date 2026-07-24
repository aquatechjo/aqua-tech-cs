-- Batch 1: separate access permissions from job identity and add the
-- organizational structure used by departments, job roles, teams, and
-- employee time allocation.

CREATE TYPE "AccessRole" AS ENUM (
  'OWNER',
  'ADMIN',
  'OPERATIONS_MANAGER',
  'SALES_MANAGER',
  'FINANCE_MANAGER',
  'MEMBER'
);

CREATE TYPE "EmploymentType" AS ENUM (
  'FULL_TIME',
  'PART_TIME',
  'CONTRACTOR',
  'INTERN'
);

CREATE TYPE "EmploymentStatus" AS ENUM (
  'ACTIVE',
  'ON_LEAVE',
  'SUSPENDED',
  'TERMINATED'
);

ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'EMPLOYEE_PROFILE_UPDATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'DEPARTMENT_CREATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'DEPARTMENT_UPDATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'JOB_ROLE_CREATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'JOB_ROLE_UPDATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'TEAM_CREATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'TEAM_UPDATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'TEAM_MEMBERSHIP_UPDATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'TEAM_MEMBERSHIP_REMOVED';

CREATE TABLE "Department" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "leadProfileId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobRole" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "departmentId" TEXT,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "JobRole_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeProfile" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "employeeNumber" TEXT,
  "departmentId" TEXT,
  "jobRoleId" TEXT,
  "managerId" TEXT,
  "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
  "status" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
  "phone" TEXT,
  "location" TEXT,
  "workHoursPerWeek" DECIMAL(5,2) NOT NULL DEFAULT 40,
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EmployeeProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmployeeProfile_workHoursPerWeek_check"
    CHECK ("workHoursPerWeek" >= 0 AND "workHoursPerWeek" <= 168)
);

CREATE TABLE "Team" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "departmentId" TEXT,
  "leadProfileId" TEXT,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeamMembership" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "employeeProfileId" TEXT NOT NULL,
  "allocationPercent" INTEGER NOT NULL DEFAULT 100,
  "responsibility" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TeamMembership_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TeamMembership_allocationPercent_check"
    CHECK ("allocationPercent" >= 1 AND "allocationPercent" <= 100)
);

CREATE UNIQUE INDEX "Department_companyId_code_key"
  ON "Department"("companyId", "code");
CREATE INDEX "Department_companyId_idx" ON "Department"("companyId");
CREATE INDEX "Department_leadProfileId_idx" ON "Department"("leadProfileId");
CREATE INDEX "Department_isActive_idx" ON "Department"("isActive");
CREATE INDEX "Department_sortOrder_idx" ON "Department"("sortOrder");

CREATE UNIQUE INDEX "JobRole_companyId_code_key"
  ON "JobRole"("companyId", "code");
CREATE INDEX "JobRole_companyId_idx" ON "JobRole"("companyId");
CREATE INDEX "JobRole_departmentId_idx" ON "JobRole"("departmentId");
CREATE INDEX "JobRole_isActive_idx" ON "JobRole"("isActive");
CREATE INDEX "JobRole_sortOrder_idx" ON "JobRole"("sortOrder");

CREATE UNIQUE INDEX "EmployeeProfile_userId_key"
  ON "EmployeeProfile"("userId");
CREATE UNIQUE INDEX "EmployeeProfile_companyId_employeeNumber_key"
  ON "EmployeeProfile"("companyId", "employeeNumber");
CREATE INDEX "EmployeeProfile_companyId_idx"
  ON "EmployeeProfile"("companyId");
CREATE INDEX "EmployeeProfile_departmentId_idx"
  ON "EmployeeProfile"("departmentId");
CREATE INDEX "EmployeeProfile_jobRoleId_idx"
  ON "EmployeeProfile"("jobRoleId");
CREATE INDEX "EmployeeProfile_managerId_idx"
  ON "EmployeeProfile"("managerId");
CREATE INDEX "EmployeeProfile_status_idx" ON "EmployeeProfile"("status");

CREATE UNIQUE INDEX "Team_companyId_code_key" ON "Team"("companyId", "code");
CREATE INDEX "Team_companyId_idx" ON "Team"("companyId");
CREATE INDEX "Team_departmentId_idx" ON "Team"("departmentId");
CREATE INDEX "Team_leadProfileId_idx" ON "Team"("leadProfileId");
CREATE INDEX "Team_isActive_idx" ON "Team"("isActive");
CREATE INDEX "Team_sortOrder_idx" ON "Team"("sortOrder");

CREATE UNIQUE INDEX "TeamMembership_teamId_employeeProfileId_key"
  ON "TeamMembership"("teamId", "employeeProfileId");
CREATE INDEX "TeamMembership_companyId_idx"
  ON "TeamMembership"("companyId");
CREATE INDEX "TeamMembership_employeeProfileId_idx"
  ON "TeamMembership"("employeeProfileId");

ALTER TABLE "Department"
  ADD CONSTRAINT "Department_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobRole"
  ADD CONSTRAINT "JobRole_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobRole"
  ADD CONSTRAINT "JobRole_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmployeeProfile"
  ADD CONSTRAINT "EmployeeProfile_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeProfile"
  ADD CONSTRAINT "EmployeeProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeProfile"
  ADD CONSTRAINT "EmployeeProfile_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmployeeProfile"
  ADD CONSTRAINT "EmployeeProfile_jobRoleId_fkey"
  FOREIGN KEY ("jobRoleId") REFERENCES "JobRole"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmployeeProfile"
  ADD CONSTRAINT "EmployeeProfile_managerId_fkey"
  FOREIGN KEY ("managerId") REFERENCES "EmployeeProfile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Department"
  ADD CONSTRAINT "Department_leadProfileId_fkey"
  FOREIGN KEY ("leadProfileId") REFERENCES "EmployeeProfile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Team"
  ADD CONSTRAINT "Team_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Team"
  ADD CONSTRAINT "Team_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Team"
  ADD CONSTRAINT "Team_leadProfileId_fkey"
  FOREIGN KEY ("leadProfileId") REFERENCES "EmployeeProfile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TeamMembership"
  ADD CONSTRAINT "TeamMembership_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamMembership"
  ADD CONSTRAINT "TeamMembership_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamMembership"
  ADD CONSTRAINT "TeamMembership_employeeProfileId_fkey"
  FOREIGN KEY ("employeeProfileId") REFERENCES "EmployeeProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve the job identity represented by the old UserRole values.
WITH role_departments AS (
  SELECT DISTINCT
    "companyId",
    CASE
      WHEN "role"::text IN ('OWNER', 'ADMIN') THEN 'MANAGEMENT'
      WHEN "role"::text = 'PROJECT_MANAGER' THEN 'OPERATIONS'
      WHEN "role"::text = 'DEVELOPER' THEN 'TECHNOLOGY'
      WHEN "role"::text = 'DESIGNER' THEN 'DESIGN'
      WHEN "role"::text = 'SALES' THEN 'SALES'
      WHEN "role"::text = 'MARKETING' THEN 'MARKETING'
      WHEN "role"::text = 'SUPPORT' THEN 'SUPPORT'
      WHEN "role"::text = 'FINANCE' THEN 'FINANCE'
      ELSE 'GENERAL'
    END AS department_code
  FROM "User"
)
INSERT INTO "Department" (
  "id",
  "companyId",
  "name",
  "code",
  "description",
  "isActive",
  "sortOrder",
  "createdAt",
  "updatedAt"
)
SELECT
  'dept_' || md5("companyId" || ':' || department_code),
  "companyId",
  CASE department_code
    WHEN 'MANAGEMENT' THEN 'الإدارة'
    WHEN 'OPERATIONS' THEN 'العمليات'
    WHEN 'TECHNOLOGY' THEN 'التقنية'
    WHEN 'DESIGN' THEN 'التصميم'
    WHEN 'SALES' THEN 'المبيعات'
    WHEN 'MARKETING' THEN 'التسويق'
    WHEN 'SUPPORT' THEN 'الدعم'
    WHEN 'FINANCE' THEN 'المالية'
    ELSE 'عام'
  END,
  department_code,
  'تم إنشاؤه تلقائيًا من بيانات الموظفين الحالية',
  true,
  CASE department_code
    WHEN 'MANAGEMENT' THEN 10
    WHEN 'OPERATIONS' THEN 20
    WHEN 'TECHNOLOGY' THEN 30
    WHEN 'DESIGN' THEN 40
    WHEN 'SALES' THEN 50
    WHEN 'MARKETING' THEN 60
    WHEN 'SUPPORT' THEN 70
    WHEN 'FINANCE' THEN 80
    ELSE 90
  END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM role_departments
ON CONFLICT ("companyId", "code") DO NOTHING;

INSERT INTO "JobRole" (
  "id",
  "companyId",
  "departmentId",
  "name",
  "code",
  "description",
  "isActive",
  "sortOrder",
  "createdAt",
  "updatedAt"
)
SELECT DISTINCT
  'job_' || md5(u."companyId" || ':' || u."role"::text),
  u."companyId",
  'dept_' || md5(
    u."companyId" || ':' ||
    CASE
      WHEN u."role"::text IN ('OWNER', 'ADMIN') THEN 'MANAGEMENT'
      WHEN u."role"::text = 'PROJECT_MANAGER' THEN 'OPERATIONS'
      WHEN u."role"::text = 'DEVELOPER' THEN 'TECHNOLOGY'
      WHEN u."role"::text = 'DESIGNER' THEN 'DESIGN'
      WHEN u."role"::text = 'SALES' THEN 'SALES'
      WHEN u."role"::text = 'MARKETING' THEN 'MARKETING'
      WHEN u."role"::text = 'SUPPORT' THEN 'SUPPORT'
      WHEN u."role"::text = 'FINANCE' THEN 'FINANCE'
      ELSE 'GENERAL'
    END
  ),
  CASE u."role"::text
    WHEN 'OWNER' THEN 'مالك الشركة'
    WHEN 'ADMIN' THEN 'مدير النظام'
    WHEN 'PROJECT_MANAGER' THEN 'مدير مشاريع'
    WHEN 'DEVELOPER' THEN 'مطوّر برمجيات'
    WHEN 'DESIGNER' THEN 'مصمم'
    WHEN 'SALES' THEN 'مسؤول مبيعات'
    WHEN 'MARKETING' THEN 'مسؤول تسويق'
    WHEN 'SUPPORT' THEN 'مسؤول دعم'
    WHEN 'FINANCE' THEN 'مسؤول مالية'
    ELSE 'موظف'
  END,
  u."role"::text,
  'تم إنشاؤه تلقائيًا من الدور الوظيفي السابق',
  true,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User" u
ON CONFLICT ("companyId", "code") DO NOTHING;

INSERT INTO "EmployeeProfile" (
  "id",
  "companyId",
  "userId",
  "departmentId",
  "jobRoleId",
  "employmentType",
  "status",
  "workHoursPerWeek",
  "startDate",
  "createdAt",
  "updatedAt"
)
SELECT
  'employee_' || md5(u."id"),
  u."companyId",
  u."id",
  'dept_' || md5(
    u."companyId" || ':' ||
    CASE
      WHEN u."role"::text IN ('OWNER', 'ADMIN') THEN 'MANAGEMENT'
      WHEN u."role"::text = 'PROJECT_MANAGER' THEN 'OPERATIONS'
      WHEN u."role"::text = 'DEVELOPER' THEN 'TECHNOLOGY'
      WHEN u."role"::text = 'DESIGNER' THEN 'DESIGN'
      WHEN u."role"::text = 'SALES' THEN 'SALES'
      WHEN u."role"::text = 'MARKETING' THEN 'MARKETING'
      WHEN u."role"::text = 'SUPPORT' THEN 'SUPPORT'
      WHEN u."role"::text = 'FINANCE' THEN 'FINANCE'
      ELSE 'GENERAL'
    END
  ),
  'job_' || md5(u."companyId" || ':' || u."role"::text),
  'FULL_TIME',
  CASE WHEN u."isActive" THEN 'ACTIVE' ELSE 'SUSPENDED' END::"EmploymentStatus",
  40,
  u."createdAt",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User" u
ON CONFLICT ("userId") DO NOTHING;

-- Convert the old mixed job/permission role to a permission-only access role.
ALTER TABLE "User" ADD COLUMN "accessRole" "AccessRole";

UPDATE "User"
SET "accessRole" = CASE
  WHEN "role"::text = 'OWNER' THEN 'OWNER'
  WHEN "role"::text = 'ADMIN' THEN 'ADMIN'
  WHEN "role"::text = 'PROJECT_MANAGER' THEN 'OPERATIONS_MANAGER'
  WHEN "role"::text = 'SALES' THEN 'SALES_MANAGER'
  WHEN "role"::text = 'FINANCE' THEN 'FINANCE_MANAGER'
  ELSE 'MEMBER'
END::"AccessRole";

ALTER TABLE "User" ALTER COLUMN "accessRole" SET NOT NULL;
ALTER TABLE "User" DROP COLUMN "role";
ALTER TABLE "User" RENAME COLUMN "accessRole" TO "role";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'MEMBER';
CREATE INDEX "User_role_idx" ON "User"("role");

DROP TYPE "UserRole";
