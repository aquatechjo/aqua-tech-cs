CREATE TYPE "ProjectChangeFinancialApprovalStatus" AS ENUM (
  'NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED'
);

ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_CHANGE_FINANCE_APPROVED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_CHANGE_FINANCE_REJECTED';

ALTER TABLE "ProjectChangeRequest"
  ADD COLUMN "financialAmount" DECIMAL(14,2),
  ADD COLUMN "financialCurrency" VARCHAR(3),
  ADD COLUMN "financialApprovalStatus" "ProjectChangeFinancialApprovalStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN "financialApprovalReference" TEXT,
  ADD COLUMN "financialApprovalNotes" TEXT,
  ADD COLUMN "financialApprovedById" TEXT,
  ADD COLUMN "financialApprovedAt" TIMESTAMP(3);

ALTER TABLE "ProjectChangeRequest"
  ADD CONSTRAINT "ProjectChangeRequest_financial_shape_check" CHECK (
    ("commercialImpact" = 'NONE' AND "financialAmount" IS NULL AND "financialCurrency" IS NULL AND "financialApprovalStatus" = 'NOT_REQUIRED')
    OR
    ("commercialImpact" <> 'NONE' AND "financialApprovalStatus" = 'NOT_REQUIRED' AND "financialAmount" IS NULL AND "financialCurrency" IS NULL)
    OR
    ("commercialImpact" <> 'NONE' AND "financialAmount" IS NOT NULL AND "financialAmount" > 0 AND "financialCurrency" ~ '^[A-Z]{3}$' AND "financialApprovalStatus" <> 'NOT_REQUIRED')
  ),
  ADD CONSTRAINT "ProjectChangeRequest_financial_approval_check" CHECK (
    ("financialApprovalStatus" = 'APPROVED' AND "financialApprovedById" IS NOT NULL AND "financialApprovedAt" IS NOT NULL AND length(trim("financialApprovalReference")) >= 3)
    OR
    ("financialApprovalStatus" <> 'APPROVED' AND "financialApprovedById" IS NULL AND "financialApprovedAt" IS NULL)
  );

ALTER TABLE "ProjectChangeRequest"
  ADD CONSTRAINT "ProjectChangeRequest_financialApprovedById_fkey"
  FOREIGN KEY ("financialApprovedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ProjectChangeRequest_financialApprovedById_idx" ON "ProjectChangeRequest"("financialApprovedById");
CREATE INDEX "ProjectChangeRequest_financialApprovalStatus_idx" ON "ProjectChangeRequest"("financialApprovalStatus");
