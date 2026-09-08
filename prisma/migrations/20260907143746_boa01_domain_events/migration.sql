-- AlterTable
ALTER TABLE "ProjectWorkflow" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProjectWorkflowApproval" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProjectWorkflowRule" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WorkflowEvent" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WorkflowTemplate" ALTER COLUMN "updatedAt" DROP DEFAULT;
