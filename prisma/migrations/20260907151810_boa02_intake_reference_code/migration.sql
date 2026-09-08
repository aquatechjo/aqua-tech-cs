/*
  Warnings:

  - A unique constraint covering the columns `[companyId,referenceCode]` on the table `ServiceRequest` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "DomainEventStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "whatsappBusinessNumber" TEXT;

-- AlterTable
ALTER TABLE "ServiceRequest" ADD COLUMN     "referenceCode" TEXT;

-- CreateTable
CREATE TABLE "DomainEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "DomainEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "DomainEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DomainEvent_status_createdAt_idx" ON "DomainEvent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "DomainEvent_companyId_type_idx" ON "DomainEvent"("companyId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceRequest_companyId_referenceCode_key" ON "ServiceRequest"("companyId", "referenceCode");

-- AddForeignKey
ALTER TABLE "DomainEvent" ADD CONSTRAINT "DomainEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
