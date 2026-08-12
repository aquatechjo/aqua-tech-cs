ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_AMENDMENT_INVOICE_ISSUED';

ALTER TABLE "ProjectContractAmendment"
ADD COLUMN "invoiceIssuedById" TEXT,
ADD COLUMN "invoiceIssuedAt" TIMESTAMP(3),
ADD COLUMN "invoiceIssueReference" TEXT,
ADD COLUMN "invoiceTaxDecision" TEXT;

CREATE INDEX "ProjectContractAmendment_invoiceIssuedById_idx"
ON "ProjectContractAmendment"("invoiceIssuedById");

ALTER TABLE "ProjectContractAmendment"
ADD CONSTRAINT "ProjectContractAmendment_invoiceIssuedById_fkey"
FOREIGN KEY ("invoiceIssuedById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectContractAmendment"
ADD CONSTRAINT "ProjectContractAmendment_invoiceTaxDecision_check"
CHECK (
  "invoiceTaxDecision" IS NULL OR
  "invoiceTaxDecision" IN ('TAX_APPLIED', 'TAX_EXEMPT')
);

ALTER TABLE "ProjectContractAmendment"
ADD CONSTRAINT "ProjectContractAmendment_invoiceIssuanceEvidence_check"
CHECK (
  ("invoiceIssuedAt" IS NULL AND "invoiceIssuedById" IS NULL AND "invoiceIssueReference" IS NULL AND "invoiceTaxDecision" IS NULL)
  OR
  ("invoiceIssuedAt" IS NOT NULL AND "invoiceIssuedById" IS NOT NULL AND "invoiceIssueReference" IS NOT NULL AND "invoiceTaxDecision" IS NOT NULL)
);
