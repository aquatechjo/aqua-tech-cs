ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_AMENDMENT_INVOICE_PORTAL_DELIVERY_PREPARED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_AMENDMENT_INVOICE_PORTAL_DELIVERY_FAILED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_AMENDMENT_INVOICE_PORTAL_SENT';

ALTER TABLE "ProjectContractAmendment"
ADD COLUMN "invoicePortalDeliveryRecipientName" TEXT,
ADD COLUMN "invoicePortalDeliveryRecipientEmail" TEXT,
ADD COLUMN "invoicePortalDeliveryProviderId" TEXT,
ADD COLUMN "invoicePortalDeliveryPreparedAt" TIMESTAMP(3),
ADD COLUMN "invoicePortalDeliverySentAt" TIMESTAMP(3),
ADD COLUMN "invoicePortalDeliveryFailedAt" TIMESTAMP(3),
ADD COLUMN "invoicePortalDeliveryFailureReason" TEXT,
ADD COLUMN "invoicePortalDeliveryAttemptCount" INTEGER NOT NULL DEFAULT 0;
