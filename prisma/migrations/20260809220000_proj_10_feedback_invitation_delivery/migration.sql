ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_FEEDBACK_DELIVERY_PREPARED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_FEEDBACK_DELIVERY_FAILED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_FEEDBACK_SENT';

ALTER TABLE "ProjectFeedback"
ADD COLUMN "deliveryRecipientName" TEXT,
ADD COLUMN "deliveryRecipientEmail" TEXT,
ADD COLUMN "deliveryProviderId" TEXT,
ADD COLUMN "deliveryPreparedAt" TIMESTAMP(3),
ADD COLUMN "deliverySentAt" TIMESTAMP(3),
ADD COLUMN "deliveryFailedAt" TIMESTAMP(3),
ADD COLUMN "deliveryFailureReason" TEXT,
ADD COLUMN "deliveryAttemptCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ProjectFeedback"
ADD CONSTRAINT "ProjectFeedback_delivery_attempt_count_check"
CHECK ("deliveryAttemptCount" >= 0),
ADD CONSTRAINT "ProjectFeedback_delivery_recipient_check"
CHECK (
  ("deliveryRecipientName" IS NULL AND "deliveryRecipientEmail" IS NULL)
  OR
  ("deliveryRecipientName" IS NOT NULL AND "deliveryRecipientEmail" IS NOT NULL)
);
