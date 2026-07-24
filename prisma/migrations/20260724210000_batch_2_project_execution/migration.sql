-- Batch 2: project execution layer for project members, phases, task
-- participants, dependencies, blockers, progress, and My Day.

CREATE TYPE "ProjectMemberRole" AS ENUM (
  'PROJECT_LEAD',
  'MANAGER',
  'CONTRIBUTOR',
  'VIEWER'
);

CREATE TYPE "ProjectPhaseStatus" AS ENUM (
  'PLANNED',
  'ACTIVE',
  'BLOCKED',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE "TaskParticipantRole" AS ENUM (
  'OWNER',
  'CONTRIBUTOR',
  'REVIEWER',
  'OBSERVER'
);

CREATE TYPE "TaskDependencyType" AS ENUM (
  'FINISH_TO_START',
  'START_TO_START',
  'FINISH_TO_FINISH',
  'START_TO_FINISH'
);

CREATE TYPE "TaskBlockerSeverity" AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
);

CREATE TYPE "TaskBlockerStatus" AS ENUM (
  'OPEN',
  'RESOLVED',
  'DISMISSED'
);

ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'PROJECT_MEMBER_ADDED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'PROJECT_MEMBER_UPDATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'PROJECT_MEMBER_REMOVED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'PROJECT_PHASE_CREATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'PROJECT_PHASE_UPDATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'PROJECT_PHASE_REMOVED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'TASK_PARTICIPANT_ADDED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'TASK_PARTICIPANT_UPDATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'TASK_PARTICIPANT_REMOVED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'TASK_DEPENDENCY_ADDED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'TASK_DEPENDENCY_REMOVED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'TASK_BLOCKER_CREATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'TASK_BLOCKER_UPDATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'TASK_BLOCKER_RESOLVED';

ALTER TABLE "Task"
  ADD COLUMN "phaseId" TEXT,
  ADD COLUMN "progress" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "startedAt" TIMESTAMP(3);

ALTER TABLE "Task"
  ADD CONSTRAINT "Task_progress_check"
  CHECK ("progress" >= 0 AND "progress" <= 100);

CREATE TABLE "ProjectMember" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "employeeProfileId" TEXT NOT NULL,
  "role" "ProjectMemberRole" NOT NULL DEFAULT 'CONTRIBUTOR',
  "responsibility" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectPhase" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "description" TEXT,
  "status" "ProjectPhaseStatus" NOT NULL DEFAULT 'PLANNED',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "startDate" TIMESTAMP(3),
  "dueDate" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProjectPhase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectPhase_progress_check"
    CHECK ("progress" >= 0 AND "progress" <= 100),
  CONSTRAINT "ProjectPhase_date_order_check"
    CHECK ("startDate" IS NULL OR "dueDate" IS NULL OR "dueDate" >= "startDate")
);

CREATE TABLE "TaskParticipant" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "employeeProfileId" TEXT NOT NULL,
  "role" "TaskParticipantRole" NOT NULL DEFAULT 'CONTRIBUTOR',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TaskParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskDependency" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "dependsOnTaskId" TEXT NOT NULL,
  "type" "TaskDependencyType" NOT NULL DEFAULT 'FINISH_TO_START',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TaskDependency_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TaskDependency_no_self_reference_check"
    CHECK ("taskId" <> "dependsOnTaskId")
);

CREATE TABLE "TaskBlocker" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "reportedById" TEXT,
  "resolvedById" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "severity" "TaskBlockerSeverity" NOT NULL DEFAULT 'MEDIUM',
  "status" "TaskBlockerStatus" NOT NULL DEFAULT 'OPEN',
  "resolution" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TaskBlocker_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectMember_projectId_employeeProfileId_key"
  ON "ProjectMember"("projectId", "employeeProfileId");
CREATE INDEX "ProjectMember_companyId_idx" ON "ProjectMember"("companyId");
CREATE INDEX "ProjectMember_employeeProfileId_idx"
  ON "ProjectMember"("employeeProfileId");
CREATE INDEX "ProjectMember_role_idx" ON "ProjectMember"("role");

CREATE UNIQUE INDEX "ProjectPhase_projectId_code_key"
  ON "ProjectPhase"("projectId", "code");
CREATE INDEX "ProjectPhase_companyId_idx" ON "ProjectPhase"("companyId");
CREATE INDEX "ProjectPhase_projectId_idx" ON "ProjectPhase"("projectId");
CREATE INDEX "ProjectPhase_status_idx" ON "ProjectPhase"("status");
CREATE INDEX "ProjectPhase_sortOrder_idx" ON "ProjectPhase"("sortOrder");

CREATE UNIQUE INDEX "TaskParticipant_taskId_employeeProfileId_key"
  ON "TaskParticipant"("taskId", "employeeProfileId");
CREATE INDEX "TaskParticipant_companyId_idx"
  ON "TaskParticipant"("companyId");
CREATE INDEX "TaskParticipant_employeeProfileId_idx"
  ON "TaskParticipant"("employeeProfileId");
CREATE INDEX "TaskParticipant_role_idx" ON "TaskParticipant"("role");

CREATE UNIQUE INDEX "TaskDependency_taskId_dependsOnTaskId_key"
  ON "TaskDependency"("taskId", "dependsOnTaskId");
CREATE INDEX "TaskDependency_companyId_idx"
  ON "TaskDependency"("companyId");
CREATE INDEX "TaskDependency_dependsOnTaskId_idx"
  ON "TaskDependency"("dependsOnTaskId");

CREATE INDEX "TaskBlocker_companyId_idx" ON "TaskBlocker"("companyId");
CREATE INDEX "TaskBlocker_taskId_idx" ON "TaskBlocker"("taskId");
CREATE INDEX "TaskBlocker_reportedById_idx" ON "TaskBlocker"("reportedById");
CREATE INDEX "TaskBlocker_resolvedById_idx" ON "TaskBlocker"("resolvedById");
CREATE INDEX "TaskBlocker_status_idx" ON "TaskBlocker"("status");
CREATE INDEX "TaskBlocker_severity_idx" ON "TaskBlocker"("severity");

CREATE INDEX "Task_phaseId_idx" ON "Task"("phaseId");

ALTER TABLE "ProjectMember"
  ADD CONSTRAINT "ProjectMember_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMember"
  ADD CONSTRAINT "ProjectMember_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMember"
  ADD CONSTRAINT "ProjectMember_employeeProfileId_fkey"
  FOREIGN KEY ("employeeProfileId") REFERENCES "EmployeeProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectPhase"
  ADD CONSTRAINT "ProjectPhase_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectPhase"
  ADD CONSTRAINT "ProjectPhase_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Task"
  ADD CONSTRAINT "Task_phaseId_fkey"
  FOREIGN KEY ("phaseId") REFERENCES "ProjectPhase"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TaskParticipant"
  ADD CONSTRAINT "TaskParticipant_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskParticipant"
  ADD CONSTRAINT "TaskParticipant_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskParticipant"
  ADD CONSTRAINT "TaskParticipant_employeeProfileId_fkey"
  FOREIGN KEY ("employeeProfileId") REFERENCES "EmployeeProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskDependency"
  ADD CONSTRAINT "TaskDependency_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskDependency"
  ADD CONSTRAINT "TaskDependency_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskDependency"
  ADD CONSTRAINT "TaskDependency_dependsOnTaskId_fkey"
  FOREIGN KEY ("dependsOnTaskId") REFERENCES "Task"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskBlocker"
  ADD CONSTRAINT "TaskBlocker_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskBlocker"
  ADD CONSTRAINT "TaskBlocker_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskBlocker"
  ADD CONSTRAINT "TaskBlocker_reportedById_fkey"
  FOREIGN KEY ("reportedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaskBlocker"
  ADD CONSTRAINT "TaskBlocker_resolvedById_fkey"
  FOREIGN KEY ("resolvedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve the existing primary assignee as both a project contributor and a
-- task owner in the richer execution model.
INSERT INTO "ProjectMember" (
  "id",
  "companyId",
  "projectId",
  "employeeProfileId",
  "role",
  "responsibility",
  "createdAt",
  "updatedAt"
)
SELECT DISTINCT
  'project_member_' || md5(t."projectId" || ':' || ep."id"),
  t."companyId",
  t."projectId",
  ep."id",
  'CONTRIBUTOR'::"ProjectMemberRole",
  'تمت إضافته تلقائيًا من المهام الحالية',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Task" t
JOIN "EmployeeProfile" ep ON ep."userId" = t."assignedToId"
WHERE t."projectId" IS NOT NULL
ON CONFLICT ("projectId", "employeeProfileId") DO NOTHING;

INSERT INTO "TaskParticipant" (
  "id",
  "companyId",
  "taskId",
  "employeeProfileId",
  "role",
  "createdAt",
  "updatedAt"
)
SELECT
  'task_participant_' || md5(t."id" || ':' || ep."id"),
  t."companyId",
  t."id",
  ep."id",
  'OWNER'::"TaskParticipantRole",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Task" t
JOIN "EmployeeProfile" ep ON ep."userId" = t."assignedToId"
ON CONFLICT ("taskId", "employeeProfileId") DO NOTHING;

UPDATE "Task"
SET
  "progress" = CASE WHEN "status" = 'DONE' THEN 100 ELSE 0 END,
  "startedAt" = CASE
    WHEN "status" IN ('IN_PROGRESS', 'BLOCKED', 'REVIEW', 'DONE') THEN "createdAt"
    ELSE NULL
  END;
