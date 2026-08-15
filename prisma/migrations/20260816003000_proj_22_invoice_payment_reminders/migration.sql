ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_AMENDMENT_INVOICE_REMINDER_PREPARED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_AMENDMENT_INVOICE_REMINDER_FAILED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_AMENDMENT_INVOICE_REMINDER_SENT';

ALTER TABLE "ProjectContractAmendment"
ADD COLUMN "invoiceReminderProviderId" TEXT,
ADD COLUMN "invoiceReminderPreparedAt" TIMESTAMP(3),
ADD COLUMN "invoiceReminderSentAt" TIMESTAMP(3),
ADD COLUMN "invoiceReminderFailedAt" TIMESTAMP(3),
ADD COLUMN "invoiceReminderFailureReason" TEXT,
ADD COLUMN "invoiceReminderAttemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "invoiceReminderCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "invoiceReminderPendingTokenHash" TEXT,
ADD COLUMN "invoiceReminderPendingExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "ProjectContractAmendment_invoiceReminderPendingTokenHash_key"
ON "ProjectContractAmendment"("invoiceReminderPendingTokenHash");
