CREATE TYPE "InvoiceCollectionStatus" AS ENUM ('NEW', 'CONTACTED', 'PROMISED', 'DISPUTED', 'ESCALATED', 'CLOSED');
ALTER TYPE "ActivityAction" ADD VALUE 'INVOICE_COLLECTION_UPDATED';
ALTER TABLE "Invoice"
ADD COLUMN "collectionOwnerId" TEXT,
ADD COLUMN "collectionStatus" "InvoiceCollectionStatus" NOT NULL DEFAULT 'NEW',
ADD COLUMN "collectionNextAction" TEXT,
ADD COLUMN "collectionNextActionAt" TIMESTAMP(3),
ADD COLUMN "collectionPromiseDate" TIMESTAMP(3),
ADD COLUMN "collectionNotes" TEXT,
ADD COLUMN "collectionUpdatedAt" TIMESTAMP(3);
CREATE INDEX "Invoice_collectionOwnerId_idx" ON "Invoice"("collectionOwnerId");
CREATE INDEX "invoice_collection_queue_idx" ON "Invoice"("companyId", "collectionStatus", "collectionNextActionAt");
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_collectionOwnerId_fkey" FOREIGN KEY ("collectionOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
