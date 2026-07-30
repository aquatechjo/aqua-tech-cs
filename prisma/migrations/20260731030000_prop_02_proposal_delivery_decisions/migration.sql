ALTER TYPE "ProposalWorkspaceStatus"
ADD VALUE IF NOT EXISTS 'SENT';

ALTER TYPE "ProposalWorkspaceStatus"
ADD VALUE IF NOT EXISTS 'CLIENT_CHANGES_REQUESTED';

ALTER TYPE "ProposalWorkspaceStatus"
ADD VALUE IF NOT EXISTS 'ACCEPTED';

ALTER TYPE "ProposalWorkspaceStatus"
ADD VALUE IF NOT EXISTS 'REJECTED';

CREATE TYPE "ProposalDeliveryChannel" AS ENUM (
    'EMAIL',
    'SECURE_LINK',
    'WHATSAPP'
);

CREATE TYPE "ProposalDeliveryStatus" AS ENUM (
    'PREPARED',
    'SENT',
    'FAILED',
    'REVOKED'
);

CREATE TYPE "ProposalClientDecision" AS ENUM (
    'ACCEPTED',
    'CHANGES_REQUESTED',
    'REJECTED'
);

ALTER TYPE "ActivityAction"
ADD VALUE IF NOT EXISTS 'PROPOSAL_DELIVERY_PREPARED';

ALTER TYPE "ActivityAction"
ADD VALUE IF NOT EXISTS 'PROPOSAL_DELIVERY_FAILED';

ALTER TYPE "ActivityAction"
ADD VALUE IF NOT EXISTS 'PROPOSAL_SENT';

ALTER TYPE "ActivityAction"
ADD VALUE IF NOT EXISTS 'PROPOSAL_LINK_REVOKED';

ALTER TYPE "ActivityAction"
ADD VALUE IF NOT EXISTS 'PROPOSAL_VIEWED';

ALTER TYPE "ActivityAction"
ADD VALUE IF NOT EXISTS 'PROPOSAL_CLIENT_CHANGES_REQUESTED';

ALTER TYPE "ActivityAction"
ADD VALUE IF NOT EXISTS 'PROPOSAL_CLIENT_ACCEPTED';

ALTER TYPE "ActivityAction"
ADD VALUE IF NOT EXISTS 'PROPOSAL_CLIENT_REJECTED';

ALTER TABLE "ProposalWorkspace"
ADD COLUMN "sentVersion" INTEGER,
ADD COLUMN "sentClientContentHash" TEXT,
ADD COLUMN "sentAt" TIMESTAMP(3),
ADD COLUMN "clientRespondedAt" TIMESTAMP(3),
ADD COLUMN "clientResponseName" TEXT,
ADD COLUMN "clientResponseEmail" TEXT,
ADD COLUMN "clientResponseTitle" TEXT,
ADD COLUMN "clientResponseNotes" TEXT,
ADD CONSTRAINT "ProposalWorkspace_sentVersion_check"
  CHECK ("sentVersion" IS NULL OR "sentVersion" > 0);

CREATE TABLE "ProposalDelivery" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdById" TEXT,
    "channel" "ProposalDeliveryChannel" NOT NULL,
    "status" "ProposalDeliveryStatus" NOT NULL DEFAULT 'PREPARED',
    "version" INTEGER NOT NULL,
    "clientContentHash" TEXT NOT NULL,
    "recipientName" TEXT,
    "recipientEmail" TEXT,
    "recipientPhone" TEXT,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "providerMessageId" TEXT,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "preparedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "firstViewedAt" TIMESTAMP(3),
    "lastViewedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProposalDelivery_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProposalDelivery_version_check"
      CHECK ("version" > 0),
    CONSTRAINT "ProposalDelivery_viewCount_check"
      CHECK ("viewCount" >= 0)
);

CREATE TABLE "ProposalClientResponse" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "clientContentHash" TEXT NOT NULL,
    "decision" "ProposalClientDecision" NOT NULL,
    "responderName" TEXT NOT NULL,
    "responderEmail" TEXT NOT NULL,
    "responderTitle" TEXT,
    "notes" TEXT,
    "authorityConfirmed" BOOLEAN NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "respondedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalClientResponse_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProposalClientResponse_version_check"
      CHECK ("version" > 0),
    CONSTRAINT "ProposalClientResponse_authority_check"
      CHECK ("authorityConfirmed" = TRUE)
);

CREATE UNIQUE INDEX "ProposalDelivery_tokenHash_key"
ON "ProposalDelivery"("tokenHash");

CREATE INDEX "ProposalDelivery_companyId_idx"
ON "ProposalDelivery"("companyId");

CREATE INDEX "ProposalDelivery_workspaceId_idx"
ON "ProposalDelivery"("workspaceId");

CREATE INDEX "ProposalDelivery_createdById_idx"
ON "ProposalDelivery"("createdById");

CREATE INDEX "ProposalDelivery_status_idx"
ON "ProposalDelivery"("status");

CREATE INDEX "ProposalDelivery_expiresAt_idx"
ON "ProposalDelivery"("expiresAt");

CREATE INDEX "ProposalDelivery_sentAt_idx"
ON "ProposalDelivery"("sentAt");

CREATE UNIQUE INDEX "ProposalClientResponse_workspaceId_version_key"
ON "ProposalClientResponse"("workspaceId", "version");

CREATE INDEX "ProposalClientResponse_companyId_idx"
ON "ProposalClientResponse"("companyId");

CREATE INDEX "ProposalClientResponse_deliveryId_idx"
ON "ProposalClientResponse"("deliveryId");

CREATE INDEX "ProposalClientResponse_decision_idx"
ON "ProposalClientResponse"("decision");

CREATE INDEX "ProposalClientResponse_respondedAt_idx"
ON "ProposalClientResponse"("respondedAt");

CREATE INDEX "ProposalWorkspace_sentAt_idx"
ON "ProposalWorkspace"("sentAt");

CREATE INDEX "ProposalWorkspace_clientRespondedAt_idx"
ON "ProposalWorkspace"("clientRespondedAt");

ALTER TABLE "ProposalDelivery"
ADD CONSTRAINT "ProposalDelivery_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProposalDelivery"
ADD CONSTRAINT "ProposalDelivery_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "ProposalWorkspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProposalDelivery"
ADD CONSTRAINT "ProposalDelivery_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProposalClientResponse"
ADD CONSTRAINT "ProposalClientResponse_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProposalClientResponse"
ADD CONSTRAINT "ProposalClientResponse_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "ProposalWorkspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProposalClientResponse"
ADD CONSTRAINT "ProposalClientResponse_deliveryId_fkey"
FOREIGN KEY ("deliveryId") REFERENCES "ProposalDelivery"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
