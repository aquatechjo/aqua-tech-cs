ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_AMENDMENT_INVOICE_PORTAL_ISSUED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_AMENDMENT_INVOICE_PORTAL_REVOKED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_AMENDMENT_INVOICE_PORTAL_VIEWED';

ALTER TABLE "ProjectContractAmendment"
  ADD COLUMN "invoicePortalTokenHash" TEXT,
  ADD COLUMN "invoicePortalExpiresAt" TIMESTAMP(3),
  ADD COLUMN "invoicePortalIssuedAt" TIMESTAMP(3),
  ADD COLUMN "invoicePortalRevokedAt" TIMESTAMP(3),
  ADD COLUMN "invoicePortalFirstViewedAt" TIMESTAMP(3),
  ADD COLUMN "invoicePortalLastViewedAt" TIMESTAMP(3),
  ADD COLUMN "invoicePortalViewCount" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "ProjectContractAmendment_invoicePortalTokenHash_key" ON "ProjectContractAmendment"("invoicePortalTokenHash");
ALTER TABLE "ProjectContractAmendment" ADD CONSTRAINT "ProjectContractAmendment_invoicePortalViewCount_check" CHECK ("invoicePortalViewCount" >= 0);
