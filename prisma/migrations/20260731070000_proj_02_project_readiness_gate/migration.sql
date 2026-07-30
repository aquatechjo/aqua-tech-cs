CREATE TYPE "ProjectContractStatus" AS ENUM (
    'PENDING',
    'SIGNED'
);

ALTER TYPE "ActivityAction"
ADD VALUE IF NOT EXISTS 'PROJECT_READINESS_UPDATED';

ALTER TYPE "ActivityAction"
ADD VALUE IF NOT EXISTS 'PROJECT_READINESS_OVERRIDE_GRANTED';

ALTER TYPE "ActivityAction"
ADD VALUE IF NOT EXISTS 'PROJECT_READINESS_OVERRIDE_REVOKED';

ALTER TYPE "ActivityAction"
ADD VALUE IF NOT EXISTS 'PROJECT_STARTED';

CREATE TABLE "ProjectReadiness" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contractRequired" BOOLEAN NOT NULL DEFAULT FALSE,
    "contractStatus" "ProjectContractStatus" NOT NULL DEFAULT 'PENDING',
    "contractReference" TEXT,
    "contractSignedAt" TIMESTAMP(3),
    "contractVerifiedById" TEXT,
    "contractVerifiedAt" TIMESTAMP(3),
    "paymentRequired" BOOLEAN NOT NULL DEFAULT FALSE,
    "requiredPaymentAmount" DECIMAL(14, 2),
    "currency" TEXT NOT NULL DEFAULT 'JOD',
    "paymentConfiguredById" TEXT,
    "paymentConfiguredAt" TIMESTAMP(3),
    "overrideReason" TEXT,
    "overrideGrantedAt" TIMESTAMP(3),
    "overrideGrantedById" TEXT,
    "activatedAt" TIMESTAMP(3),
    "activatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectReadiness_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProjectReadiness_requiredPaymentAmount_check"
      CHECK (
        "requiredPaymentAmount" IS NULL
        OR "requiredPaymentAmount" >= 0
      ),
    CONSTRAINT "ProjectReadiness_currency_check"
      CHECK ("currency" ~ '^[A-Z]{3}$'),
    CONSTRAINT "ProjectReadiness_contractSigned_check"
      CHECK (
        "contractStatus" <> 'SIGNED'
        OR (
          "contractSignedAt" IS NOT NULL
          AND "contractVerifiedAt" IS NOT NULL
        )
      ),
    CONSTRAINT "ProjectReadiness_override_check"
      CHECK (
        (
          "overrideGrantedAt" IS NULL
          AND "overrideGrantedById" IS NULL
          AND "overrideReason" IS NULL
        )
        OR
        (
          "overrideGrantedAt" IS NOT NULL
          AND "overrideGrantedById" IS NOT NULL
          AND "overrideReason" IS NOT NULL
          AND length(trim("overrideReason")) >= 10
        )
      ),
    CONSTRAINT "ProjectReadiness_activation_check"
      CHECK (
        (
          "activatedAt" IS NULL
          AND "activatedById" IS NULL
        )
        OR
        (
          "activatedAt" IS NOT NULL
          AND "activatedById" IS NOT NULL
        )
      )
);

CREATE UNIQUE INDEX "ProjectReadiness_projectId_key"
ON "ProjectReadiness"("projectId");

CREATE INDEX "ProjectReadiness_companyId_idx"
ON "ProjectReadiness"("companyId");

CREATE INDEX "ProjectReadiness_contractStatus_idx"
ON "ProjectReadiness"("contractStatus");

CREATE INDEX "ProjectReadiness_activatedAt_idx"
ON "ProjectReadiness"("activatedAt");

CREATE INDEX "ProjectReadiness_contractVerifiedById_idx"
ON "ProjectReadiness"("contractVerifiedById");

CREATE INDEX "ProjectReadiness_paymentConfiguredById_idx"
ON "ProjectReadiness"("paymentConfiguredById");

CREATE INDEX "ProjectReadiness_overrideGrantedById_idx"
ON "ProjectReadiness"("overrideGrantedById");

CREATE INDEX "ProjectReadiness_activatedById_idx"
ON "ProjectReadiness"("activatedById");

ALTER TABLE "ProjectReadiness"
ADD CONSTRAINT "ProjectReadiness_companyId_fkey"
  FOREIGN KEY ("companyId")
  REFERENCES "Company"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE,
ADD CONSTRAINT "ProjectReadiness_projectId_fkey"
  FOREIGN KEY ("projectId")
  REFERENCES "Project"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE,
ADD CONSTRAINT "ProjectReadiness_contractVerifiedById_fkey"
  FOREIGN KEY ("contractVerifiedById")
  REFERENCES "User"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE,
ADD CONSTRAINT "ProjectReadiness_paymentConfiguredById_fkey"
  FOREIGN KEY ("paymentConfiguredById")
  REFERENCES "User"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE,
ADD CONSTRAINT "ProjectReadiness_overrideGrantedById_fkey"
  FOREIGN KEY ("overrideGrantedById")
  REFERENCES "User"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE,
ADD CONSTRAINT "ProjectReadiness_activatedById_fkey"
  FOREIGN KEY ("activatedById")
  REFERENCES "User"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

INSERT INTO "ProjectReadiness" (
    "id",
    "companyId",
    "projectId",
    "contractRequired",
    "paymentRequired",
    "currency",
    "activatedAt",
    "activatedById",
    "createdAt",
    "updatedAt"
)
SELECT
    concat('ready_', md5("Project"."id")),
    "Project"."companyId",
    "Project"."id",
    (
      "Project"."status" = 'PLANNING'
      AND "Project"."originProposalWorkspaceId" IS NOT NULL
    ),
    (
      "Project"."status" = 'PLANNING'
      AND "Project"."originProposalWorkspaceId" IS NOT NULL
    ),
    "Project"."currency",
    CASE
      WHEN "Project"."status" = 'PLANNING' THEN NULL
      ELSE COALESCE("Project"."startDate", "Project"."createdAt")
    END,
    CASE
      WHEN "Project"."status" = 'PLANNING' THEN NULL
      ELSE (
        SELECT "User"."id"
        FROM "User"
        WHERE "User"."companyId" = "Project"."companyId"
        ORDER BY
          CASE "User"."role"
            WHEN 'OWNER' THEN 0
            WHEN 'ADMIN' THEN 1
            ELSE 2
          END,
          "User"."createdAt"
        LIMIT 1
      )
    END,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Project";
