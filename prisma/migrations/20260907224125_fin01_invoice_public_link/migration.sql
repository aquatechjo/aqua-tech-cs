/*
  Warnings:

  - A unique constraint covering the columns `[publicTokenHash]` on the table `Invoice` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityAction" ADD VALUE 'INVOICE_PUBLIC_LINK_ISSUED';
ALTER TYPE "ActivityAction" ADD VALUE 'INVOICE_PUBLIC_LINK_REVOKED';
ALTER TYPE "ActivityAction" ADD VALUE 'INVOICE_PUBLIC_LINK_VIEWED';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "publicExpiresAt" TIMESTAMP(3),
ADD COLUMN     "publicFirstViewedAt" TIMESTAMP(3),
ADD COLUMN     "publicIssuedAt" TIMESTAMP(3),
ADD COLUMN     "publicLastViewedAt" TIMESTAMP(3),
ADD COLUMN     "publicRevokedAt" TIMESTAMP(3),
ADD COLUMN     "publicTokenHash" TEXT,
ADD COLUMN     "publicViewCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_publicTokenHash_key" ON "Invoice"("publicTokenHash");
