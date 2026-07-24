-- Batch 3: operational finance for invoices, payments, reversals, expenses,
-- document numbering, cash visibility, and project margin control.

CREATE TYPE "InvoiceStatus" AS ENUM (
  'DRAFT',
  'ISSUED',
  'PARTIALLY_PAID',
  'PAID',
  'CANCELLED'
);

CREATE TYPE "PaymentMethod" AS ENUM (
  'CASH',
  'BANK_TRANSFER',
  'CARD',
  'WALLET',
  'CHEQUE',
  'OTHER'
);

CREATE TYPE "PaymentStatus" AS ENUM (
  'POSTED',
  'REVERSED'
);

CREATE TYPE "ExpenseStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'PAID',
  'CANCELLED'
);

ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'INVOICE_CREATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'INVOICE_UPDATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'INVOICE_ISSUED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'INVOICE_CANCELLED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'PAYMENT_RECORDED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'PAYMENT_REVERSED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'EXPENSE_CREATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'EXPENSE_UPDATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'EXPENSE_SUBMITTED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'EXPENSE_APPROVED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'EXPENSE_REJECTED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'EXPENSE_PAID';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'EXPENSE_CANCELLED';

CREATE TABLE "DocumentSequence" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "currentValue" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DocumentSequence_currentValue_check" CHECK ("currentValue" >= 0)
);

CREATE TABLE "Invoice" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "clientId" TEXT,
  "projectId" TEXT,
  "serviceRequestId" TEXT,
  "createdById" TEXT,
  "invoiceNumber" TEXT NOT NULL,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "currency" TEXT NOT NULL DEFAULT 'JOD',
  "issueDate" TIMESTAMP(3),
  "dueDate" TIMESTAMP(3),
  "subtotal" DECIMAL(14,2) NOT NULL,
  "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(14,2) NOT NULL,
  "amountPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "terms" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Invoice_currency_check" CHECK (char_length("currency") = 3),
  CONSTRAINT "Invoice_amounts_check" CHECK (
    "subtotal" >= 0 AND
    "discountAmount" >= 0 AND
    "taxAmount" >= 0 AND
    "totalAmount" > 0 AND
    "amountPaid" >= 0 AND
    "amountPaid" <= "totalAmount" AND
    "discountAmount" <= "subtotal" AND
    "totalAmount" = "subtotal" - "discountAmount" + "taxAmount"
  ),
  CONSTRAINT "Invoice_date_order_check" CHECK (
    "issueDate" IS NULL OR "dueDate" IS NULL OR "dueDate" >= "issueDate"
  ),
  CONSTRAINT "Invoice_status_payment_check" CHECK (
    ("status" IN ('DRAFT', 'ISSUED', 'CANCELLED') AND "amountPaid" = 0) OR
    ("status" = 'PARTIALLY_PAID' AND "amountPaid" > 0 AND "amountPaid" < "totalAmount") OR
    ("status" = 'PAID' AND "amountPaid" = "totalAmount")
  )
);

CREATE TABLE "InvoiceItem" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
  "unitPrice" DECIMAL(14,2) NOT NULL,
  "lineTotal" DECIMAL(14,2) NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InvoiceItem_amounts_check" CHECK (
    "quantity" > 0 AND
    "unitPrice" >= 0 AND
    "lineTotal" >= 0 AND
    "lineTotal" = round("quantity" * "unitPrice", 2)
  )
);

CREATE TABLE "Payment" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "recordedById" TEXT,
  "reversedById" TEXT,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'JOD',
  "method" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
  "status" "PaymentStatus" NOT NULL DEFAULT 'POSTED',
  "reference" TEXT,
  "notes" TEXT,
  "paidAt" TIMESTAMP(3) NOT NULL,
  "reversedAt" TIMESTAMP(3),
  "reversalReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Payment_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "Payment_currency_check" CHECK (char_length("currency") = 3),
  CONSTRAINT "Payment_reversal_check" CHECK (
    ("status" = 'POSTED' AND "reversedAt" IS NULL AND "reversalReason" IS NULL) OR
    ("status" = 'REVERSED' AND "reversedAt" IS NOT NULL AND "reversalReason" IS NOT NULL)
  )
);

CREATE TABLE "Expense" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "projectId" TEXT,
  "createdById" TEXT,
  "approvedById" TEXT,
  "expenseNumber" TEXT NOT NULL,
  "vendorName" TEXT,
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'JOD',
  "status" "ExpenseStatus" NOT NULL DEFAULT 'DRAFT',
  "incurredAt" TIMESTAMP(3) NOT NULL,
  "submittedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "reference" TEXT,
  "receiptUrl" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Expense_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Expense_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "Expense_currency_check" CHECK (char_length("currency") = 3)
);

CREATE UNIQUE INDEX "DocumentSequence_companyId_key_key"
  ON "DocumentSequence"("companyId", "key");
CREATE INDEX "DocumentSequence_companyId_idx" ON "DocumentSequence"("companyId");

CREATE UNIQUE INDEX "Invoice_companyId_invoiceNumber_key"
  ON "Invoice"("companyId", "invoiceNumber");
CREATE INDEX "Invoice_companyId_idx" ON "Invoice"("companyId");
CREATE INDEX "Invoice_clientId_idx" ON "Invoice"("clientId");
CREATE INDEX "Invoice_projectId_idx" ON "Invoice"("projectId");
CREATE INDEX "Invoice_serviceRequestId_idx" ON "Invoice"("serviceRequestId");
CREATE INDEX "Invoice_createdById_idx" ON "Invoice"("createdById");
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");
CREATE INDEX "Invoice_issueDate_idx" ON "Invoice"("issueDate");
CREATE INDEX "Invoice_dueDate_idx" ON "Invoice"("dueDate");

CREATE INDEX "InvoiceItem_companyId_idx" ON "InvoiceItem"("companyId");
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");
CREATE INDEX "InvoiceItem_sortOrder_idx" ON "InvoiceItem"("sortOrder");

CREATE INDEX "Payment_companyId_idx" ON "Payment"("companyId");
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");
CREATE INDEX "Payment_recordedById_idx" ON "Payment"("recordedById");
CREATE INDEX "Payment_reversedById_idx" ON "Payment"("reversedById");
CREATE INDEX "Payment_status_idx" ON "Payment"("status");
CREATE INDEX "Payment_paidAt_idx" ON "Payment"("paidAt");

CREATE UNIQUE INDEX "Expense_companyId_expenseNumber_key"
  ON "Expense"("companyId", "expenseNumber");
CREATE INDEX "Expense_companyId_idx" ON "Expense"("companyId");
CREATE INDEX "Expense_projectId_idx" ON "Expense"("projectId");
CREATE INDEX "Expense_createdById_idx" ON "Expense"("createdById");
CREATE INDEX "Expense_approvedById_idx" ON "Expense"("approvedById");
CREATE INDEX "Expense_status_idx" ON "Expense"("status");
CREATE INDEX "Expense_incurredAt_idx" ON "Expense"("incurredAt");

ALTER TABLE "DocumentSequence"
  ADD CONSTRAINT "DocumentSequence_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_serviceRequestId_fkey"
  FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvoiceItem"
  ADD CONSTRAINT "InvoiceItem_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceItem"
  ADD CONSTRAINT "InvoiceItem_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_recordedById_fkey"
  FOREIGN KEY ("recordedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_reversedById_fkey"
  FOREIGN KEY ("reversedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
