ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_AMENDMENT_IMPACT_APPLIED';

ALTER TABLE "ProjectContractAmendment"
  ADD COLUMN "impactAppliedById" TEXT,
  ADD COLUMN "impactApplicationReference" TEXT,
  ADD COLUMN "budgetBeforeSnapshot" DECIMAL(14,2),
  ADD COLUMN "budgetAfterSnapshot" DECIMAL(14,2),
  ADD COLUMN "dueDateBeforeSnapshot" TIMESTAMP(3),
  ADD COLUMN "dueDateAfterSnapshot" TIMESTAMP(3),
  ADD COLUMN "impactAppliedAt" TIMESTAMP(3);

ALTER TABLE "ProjectContractAmendment"
  ADD CONSTRAINT "ProjectContractAmendment_impact_application_check" CHECK (
    ("impactAppliedAt" IS NULL AND "impactAppliedById" IS NULL AND "impactApplicationReference" IS NULL AND "budgetBeforeSnapshot" IS NULL AND "budgetAfterSnapshot" IS NULL AND "dueDateBeforeSnapshot" IS NULL AND "dueDateAfterSnapshot" IS NULL)
    OR
    ("status" = 'ACCEPTED' AND "impactAppliedAt" IS NOT NULL AND "impactAppliedById" IS NOT NULL AND "impactApplicationReference" IS NOT NULL AND "budgetBeforeSnapshot" IS NOT NULL AND "budgetAfterSnapshot" IS NOT NULL)
  );

CREATE INDEX "ProjectContractAmendment_impactAppliedById_idx" ON "ProjectContractAmendment"("impactAppliedById");

ALTER TABLE "ProjectContractAmendment" ADD CONSTRAINT "ProjectContractAmendment_impactAppliedById_fkey" FOREIGN KEY ("impactAppliedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
