CREATE TYPE "ConversationMessageRole" AS ENUM (
    'SYSTEM',
    'CUSTOMER'
);

CREATE TYPE "ConversationMessageKind" AS ENUM (
    'INTRODUCTION',
    'QUESTION',
    'ANSWER',
    'SUMMARY',
    'ESCALATION',
    'COMPLETION'
);

ALTER TYPE "ActivityAction"
ADD VALUE IF NOT EXISTS 'DISCOVERY_PUBLIC_LINK_ISSUED';

ALTER TYPE "ActivityAction"
ADD VALUE IF NOT EXISTS 'DISCOVERY_PUBLIC_LINK_REVOKED';

ALTER TYPE "ActivityAction"
ADD VALUE IF NOT EXISTS 'DISCOVERY_CONVERSATION_STARTED';

ALTER TYPE "ActivityAction"
ADD VALUE IF NOT EXISTS 'DISCOVERY_CONVERSATION_ESCALATED';

ALTER TYPE "ActivityAction"
ADD VALUE IF NOT EXISTS 'DISCOVERY_CONVERSATION_SUBMITTED';

ALTER TABLE "IntakeSession"
ADD COLUMN "publicAccessTokenHash" TEXT,
ADD COLUMN "publicAccessExpiresAt" TIMESTAMP(3),
ADD COLUMN "publicAccessRevokedAt" TIMESTAMP(3),
ADD COLUMN "conversationStartedAt" TIMESTAMP(3),
ADD COLUMN "conversationSubmittedAt" TIMESTAMP(3),
ADD COLUMN "conversationEscalatedAt" TIMESTAMP(3),
ADD COLUMN "conversationEscalationReason" TEXT,
ADD COLUMN "privacyConsentAt" TIMESTAMP(3),
ADD COLUMN "privacyConsentVersion" TEXT,
ADD COLUMN "contactConfirmedAt" TIMESTAMP(3),
ADD COLUMN "lastCustomerMessageAt" TIMESTAMP(3);

CREATE TABLE "ConversationMessage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "intakeSessionId" TEXT NOT NULL,
    "role" "ConversationMessageRole" NOT NULL,
    "kind" "ConversationMessageKind" NOT NULL,
    "questionKey" TEXT,
    "content" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IntakeSession_publicAccessTokenHash_key"
ON "IntakeSession"("publicAccessTokenHash");

CREATE INDEX "IntakeSession_publicAccessExpiresAt_idx"
ON "IntakeSession"("publicAccessExpiresAt");

CREATE INDEX "IntakeSession_conversationSubmittedAt_idx"
ON "IntakeSession"("conversationSubmittedAt");

CREATE INDEX "IntakeSession_lastCustomerMessageAt_idx"
ON "IntakeSession"("lastCustomerMessageAt");

CREATE UNIQUE INDEX "ConversationMessage_intakeSessionId_sequence_key"
ON "ConversationMessage"("intakeSessionId", "sequence");

CREATE INDEX "ConversationMessage_companyId_idx"
ON "ConversationMessage"("companyId");

CREATE INDEX "ConversationMessage_intakeSessionId_idx"
ON "ConversationMessage"("intakeSessionId");

CREATE INDEX "ConversationMessage_questionKey_idx"
ON "ConversationMessage"("questionKey");

CREATE INDEX "ConversationMessage_createdAt_idx"
ON "ConversationMessage"("createdAt");

ALTER TABLE "ConversationMessage"
ADD CONSTRAINT "ConversationMessage_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversationMessage"
ADD CONSTRAINT "ConversationMessage_intakeSessionId_fkey"
FOREIGN KEY ("intakeSessionId") REFERENCES "IntakeSession"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
