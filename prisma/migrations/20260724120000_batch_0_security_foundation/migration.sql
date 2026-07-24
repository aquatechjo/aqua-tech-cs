-- Batch 0: distributed rate limiting and retry-safe website intake.
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

ALTER TABLE "ServiceRequest"
ADD COLUMN "idempotencyKey" TEXT;

CREATE INDEX "RateLimitBucket_expiresAt_idx"
ON "RateLimitBucket"("expiresAt");

CREATE UNIQUE INDEX "ServiceRequest_companyId_idempotencyKey_key"
ON "ServiceRequest"("companyId", "idempotencyKey");
