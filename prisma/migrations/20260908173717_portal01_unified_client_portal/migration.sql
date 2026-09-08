-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityAction" ADD VALUE 'CLIENT_PORTAL_ACCESS_ISSUED';
ALTER TYPE "ActivityAction" ADD VALUE 'CLIENT_PORTAL_ACCESS_REVOKED';

-- CreateTable
CREATE TABLE "ClientPortalAccess" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "tokenHash" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "lastAccessedAt" TIMESTAMP(3),
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientPortalAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientPortalAccess_clientId_key" ON "ClientPortalAccess"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientPortalAccess_tokenHash_key" ON "ClientPortalAccess"("tokenHash");

-- CreateIndex
CREATE INDEX "ClientPortalAccess_companyId_idx" ON "ClientPortalAccess"("companyId");

-- AddForeignKey
ALTER TABLE "ClientPortalAccess" ADD CONSTRAINT "ClientPortalAccess_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPortalAccess" ADD CONSTRAINT "ClientPortalAccess_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
