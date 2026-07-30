ALTER TYPE "ActivityAction"
ADD VALUE IF NOT EXISTS 'PROPOSAL_CONVERTED_TO_PROJECT';

ALTER TABLE "Project"
ADD COLUMN "originProposalWorkspaceId" TEXT,
ADD COLUMN "originProposalResponseId" TEXT,
ADD COLUMN "originProposalVersion" INTEGER,
ADD COLUMN "originProposalContentHash" TEXT,
ADD COLUMN "originClientContentHash" TEXT,
ADD COLUMN "clientAcceptedAt" TIMESTAMP(3),
ADD COLUMN "proposalConvertedAt" TIMESTAMP(3),
ADD CONSTRAINT "Project_originProposalVersion_check"
  CHECK (
    "originProposalVersion" IS NULL
    OR "originProposalVersion" > 0
  ),
ADD CONSTRAINT "Project_proposalOrigin_complete_check"
  CHECK (
    (
      "originProposalWorkspaceId" IS NULL
      AND "originProposalResponseId" IS NULL
      AND "originProposalVersion" IS NULL
      AND "originProposalContentHash" IS NULL
      AND "originClientContentHash" IS NULL
      AND "clientAcceptedAt" IS NULL
      AND "proposalConvertedAt" IS NULL
    )
    OR
    (
      "originProposalWorkspaceId" IS NOT NULL
      AND "originProposalResponseId" IS NOT NULL
      AND "originProposalVersion" IS NOT NULL
      AND "originProposalContentHash" IS NOT NULL
      AND "originClientContentHash" IS NOT NULL
      AND "clientAcceptedAt" IS NOT NULL
      AND "proposalConvertedAt" IS NOT NULL
    )
  ),
ADD CONSTRAINT "Project_originProposalWorkspaceId_fkey"
  FOREIGN KEY ("originProposalWorkspaceId")
  REFERENCES "ProposalWorkspace"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE,
ADD CONSTRAINT "Project_originProposalResponseId_fkey"
  FOREIGN KEY ("originProposalResponseId")
  REFERENCES "ProposalClientResponse"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Project_originProposalWorkspaceId_key"
ON "Project"("originProposalWorkspaceId");

CREATE UNIQUE INDEX "Project_originProposalResponseId_key"
ON "Project"("originProposalResponseId");

CREATE INDEX "Project_proposalConvertedAt_idx"
ON "Project"("proposalConvertedAt");
