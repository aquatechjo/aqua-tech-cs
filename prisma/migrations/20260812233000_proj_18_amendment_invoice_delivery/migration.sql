ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_AMENDMENT_INVOICE_DELIVERY_PREPARED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_AMENDMENT_INVOICE_DELIVERY_FAILED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_AMENDMENT_INVOICE_SENT';

ALTER TABLE "ProjectContractAmendment"
ADD COLUMN "invoiceDeliveryRecipientName" TEXT,
ADD COLUMN "invoiceDeliveryRecipientEmail" TEXT,
ADD COLUMN "invoiceDeliveryReference" TEXT,
ADD COLUMN "invoiceDeliveryPreparedAt" TIMESTAMP(3),
ADD COLUMN "invoiceDeliverySentAt" TIMESTAMP(3),
ADD COLUMN "invoiceDeliveryFailedAt" TIMESTAMP(3),
ADD COLUMN "invoiceDeliveryFailureReason" TEXT,
ADD COLUMN "invoiceDeliveryProviderId" TEXT,
ADD COLUMN "invoiceDeliveryAttemptCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ProjectContractAmendment"
ADD CONSTRAINT "ProjectContractAmendment_invoiceDeliveryAttemptCount_check"
CHECK ("invoiceDeliveryAttemptCount" >= 0);
