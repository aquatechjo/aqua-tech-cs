CREATE TYPE "ProjectContractAmendmentStatus" AS ENUM (
  'DRAFT',
  'READY_FOR_REVIEW',
  'INTERNALLY_APPROVED',
  'SENT',
  'ACCEPTED',
  'REJECTED'
);

ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_AMENDMENT_CREATED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_AMENDMENT_READY_FOR_REVIEW';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_AMENDMENT_INTERNALLY_APPROVED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_AMENDMENT_SENT';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_AMENDMENT_ACCEPTED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_AMENDMENT_REJECTED';

CREATE TABLE "ProjectContractAmendment" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "changeRequestId" TEXT NOT NULL,
  "createdById" TEXT,
  "approvedById" TEXT,
  "sentById" TEXT,
  "decidedById" TEXT,
  "amendmentNumber" TEXT NOT NULL,
  "status" "ProjectContractAmendmentStatus" NOT NULL DEFAULT 'DRAFT',
  "titleSnapshot" TEXT NOT NULL,
  "reasonSnapshot" TEXT NOT NULL,
  "itemsSnapshot" JSONB NOT NULL,
  "scheduleImpactDaysSnapshot" INTEGER NOT NULL,
  "financialAmountSnapshot" DECIMAL(14,2) NOT NULL,
  "financialCurrencySnapshot" VARCHAR(3) NOT NULL,
  "commercialReferenceSnapshot" TEXT,
  "internalNotes" TEXT,
  "approvalReference" TEXT,
  "deliveryReference" TEXT,
  "clientDecisionReference" TEXT,
  "clientDecisionNotes" TEXT,
  "readyAt" TIMESTAMP(3),
  "internallyApprovedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectContractAmendment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectContractAmendment_currency_check" CHECK ("financialCurrencySnapshot" ~ '^[A-Z]{3}$'),
  CONSTRAINT "ProjectContractAmendment_amount_check" CHECK ("financialAmountSnapshot" > 0),
  CONSTRAINT "ProjectContractAmendment_state_evidence_check" CHECK (
    ("status" = 'DRAFT') OR
    ("status" = 'READY_FOR_REVIEW' AND "readyAt" IS NOT NULL) OR
    ("status" = 'INTERNALLY_APPROVED' AND "readyAt" IS NOT NULL AND "internallyApprovedAt" IS NOT NULL AND "approvedById" IS NOT NULL AND "approvalReference" IS NOT NULL) OR
    ("status" = 'SENT' AND "internallyApprovedAt" IS NOT NULL AND "approvedById" IS NOT NULL AND "sentAt" IS NOT NULL AND "sentById" IS NOT NULL AND "deliveryReference" IS NOT NULL) OR
    ("status" IN ('ACCEPTED', 'REJECTED') AND "sentAt" IS NOT NULL AND "decidedAt" IS NOT NULL AND "decidedById" IS NOT NULL AND "clientDecisionReference" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "ProjectContractAmendment_changeRequestId_key" ON "ProjectContractAmendment"("changeRequestId");
CREATE UNIQUE INDEX "ProjectContractAmendment_companyId_amendmentNumber_key" ON "ProjectContractAmendment"("companyId", "amendmentNumber");
CREATE INDEX "ProjectContractAmendment_companyId_idx" ON "ProjectContractAmendment"("companyId");
CREATE INDEX "ProjectContractAmendment_projectId_idx" ON "ProjectContractAmendment"("projectId");
CREATE INDEX "ProjectContractAmendment_status_idx" ON "ProjectContractAmendment"("status");
CREATE INDEX "ProjectContractAmendment_createdById_idx" ON "ProjectContractAmendment"("createdById");
CREATE INDEX "ProjectContractAmendment_approvedById_idx" ON "ProjectContractAmendment"("approvedById");
CREATE INDEX "ProjectContractAmendment_sentById_idx" ON "ProjectContractAmendment"("sentById");
CREATE INDEX "ProjectContractAmendment_decidedById_idx" ON "ProjectContractAmendment"("decidedById");

ALTER TABLE "ProjectContractAmendment" ADD CONSTRAINT "ProjectContractAmendment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectContractAmendment" ADD CONSTRAINT "ProjectContractAmendment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectContractAmendment" ADD CONSTRAINT "ProjectContractAmendment_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "ProjectChangeRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectContractAmendment" ADD CONSTRAINT "ProjectContractAmendment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectContractAmendment" ADD CONSTRAINT "ProjectContractAmendment_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectContractAmendment" ADD CONSTRAINT "ProjectContractAmendment_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectContractAmendment" ADD CONSTRAINT "ProjectContractAmendment_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
