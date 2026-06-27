-- CreateEnum
CREATE TYPE "ServiceRequestStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'APPROVED', 'REJECTED', 'CONVERTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ServiceRequestSource" AS ENUM ('WEBSITE', 'MANUAL', 'WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'REFERRAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ServiceRequestPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityAction" ADD VALUE 'SERVICE_REQUEST_CREATED';
ALTER TYPE "ActivityAction" ADD VALUE 'SERVICE_REQUEST_UPDATED';
ALTER TYPE "ActivityAction" ADD VALUE 'SERVICE_REQUEST_CONTACTED';
ALTER TYPE "ActivityAction" ADD VALUE 'SERVICE_REQUEST_PROPOSAL_SENT';
ALTER TYPE "ActivityAction" ADD VALUE 'SERVICE_REQUEST_APPROVED';
ALTER TYPE "ActivityAction" ADD VALUE 'SERVICE_REQUEST_REJECTED';
ALTER TYPE "ActivityAction" ADD VALUE 'SERVICE_REQUEST_CONVERTED';
ALTER TYPE "ActivityAction" ADD VALUE 'SERVICE_REQUEST_ARCHIVED';
ALTER TYPE "ActivityAction" ADD VALUE 'SERVICE_REQUEST_RESTORED';

-- CreateTable
CREATE TABLE "ServiceRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientId" TEXT,
    "projectId" TEXT,
    "assignedToId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "customerCompany" TEXT,
    "serviceType" TEXT NOT NULL,
    "budgetRange" TEXT,
    "timeline" TEXT,
    "message" TEXT,
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'NEW',
    "source" "ServiceRequestSource" NOT NULL DEFAULT 'WEBSITE',
    "priority" "ServiceRequestPriority" NOT NULL DEFAULT 'MEDIUM',
    "workflowRunId" TEXT,
    "proposalUrl" TEXT,
    "proposalSentAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceRequest_companyId_idx" ON "ServiceRequest"("companyId");

-- CreateIndex
CREATE INDEX "ServiceRequest_clientId_idx" ON "ServiceRequest"("clientId");

-- CreateIndex
CREATE INDEX "ServiceRequest_projectId_idx" ON "ServiceRequest"("projectId");

-- CreateIndex
CREATE INDEX "ServiceRequest_assignedToId_idx" ON "ServiceRequest"("assignedToId");

-- CreateIndex
CREATE INDEX "ServiceRequest_status_idx" ON "ServiceRequest"("status");

-- CreateIndex
CREATE INDEX "ServiceRequest_source_idx" ON "ServiceRequest"("source");

-- CreateIndex
CREATE INDEX "ServiceRequest_priority_idx" ON "ServiceRequest"("priority");

-- CreateIndex
CREATE INDEX "ServiceRequest_createdAt_idx" ON "ServiceRequest"("createdAt");

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
