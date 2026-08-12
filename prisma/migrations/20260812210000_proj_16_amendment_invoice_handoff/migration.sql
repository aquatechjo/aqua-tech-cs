ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_AMENDMENT_INVOICE_CREATED';

ALTER TABLE "ProjectContractAmendment"
ADD COLUMN "invoiceId" TEXT,
ADD COLUMN "invoiceCreatedById" TEXT,
ADD COLUMN "invoiceCreatedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "ProjectContractAmendment_invoiceId_key"
ON "ProjectContractAmendment"("invoiceId");

CREATE INDEX "ProjectContractAmendment_invoiceCreatedById_idx"
ON "ProjectContractAmendment"("invoiceCreatedById");

ALTER TABLE "ProjectContractAmendment"
ADD CONSTRAINT "ProjectContractAmendment_invoiceId_fkey"
FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectContractAmendment"
ADD CONSTRAINT "ProjectContractAmendment_invoiceCreatedById_fkey"
FOREIGN KEY ("invoiceCreatedById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
