import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

import { buildAmendmentInvoiceDeliveryEmail } from "../../src/lib/email-templates"
import {
  amendmentInvoiceDeliveryIssues,
  amendmentInvoiceDeliverySchema,
  safeInvoiceDeliveryFailure,
  invoiceDeliveryAttemptInProgress,
} from "../../src/lib/project-amendment-invoice-delivery"

test("validates and normalizes an explicit invoice recipient", () => {
  const parsed = amendmentInvoiceDeliverySchema.parse({
    recipientName: "Client Finance",
    recipientEmail: "FINANCE@EXAMPLE.COM",
    deliveryReference: "EMAIL-2026-18",
  })
  assert.equal(parsed.recipientEmail, "finance@example.com")
})

test("allows one successful delivery for an issued linked invoice", () => {
  assert.deepEqual(
    amendmentInvoiceDeliveryIssues({
      invoiceStatus: "ISSUED",
      invoiceIssuedAt: new Date(),
      deliverySentAt: null,
      clientId: "client-1",
      projectClientId: "client-1",
    }),
    [],
  )
})

test("blocks drafts, incomplete issuance, duplicates, and client drift", () => {
  const issues = amendmentInvoiceDeliveryIssues({
    invoiceStatus: "DRAFT",
    invoiceIssuedAt: null,
    deliverySentAt: new Date(),
    clientId: "client-2",
    projectClientId: "client-1",
  })
  assert.equal(issues.length, 4)
})

test("email escapes client data and exposes no internal system link", () => {
  const email = buildAmendmentInvoiceDeliveryEmail({
    recipientName: "<script>alert(1)</script>",
    invoiceNumber: "INV-2026-0018",
    amendmentNumber: "AMD-CR-18",
    projectName: "Project <unsafe>",
    totalAmount: "250.00",
    currency: "JOD",
    issueDate: "2026-08-12",
    dueDate: "2026-09-12",
    companyEmail: "info@example.com",
  })
  assert.doesNotMatch(email.html, /<script>/)
  assert.doesNotMatch(email.html, /href=/)
  assert.match(email.text, /لا تحتوي رابطًا إلى النظام الداخلي/)
})

test("concurrent delivery lock expires after a bounded recovery window", () => {
  const now = new Date("2026-08-12T12:30:00Z")
  assert.equal(
    invoiceDeliveryAttemptInProgress({
      preparedAt: "2026-08-12T12:20:00Z",
      failedAt: null,
      now,
    }),
    true,
  )
  assert.equal(
    invoiceDeliveryAttemptInProgress({
      preparedAt: "2026-08-12T12:00:00Z",
      failedAt: null,
      now,
    }),
    false,
  )
})

test("delivery is finance-owned, locked, audited, retry-safe, and sanitizes failure", async () => {
  const root = process.cwd()
  const [schema, route, client, email] = await Promise.all([
    readFile(path.join(root, "prisma/schema.prisma"), "utf8"),
    readFile(path.join(root, "src/app/api/finance/invoices/[id]/delivery/route.ts"), "utf8"),
    readFile(path.join(root, "src/app/dashboard/finance/invoices/[id]/InvoiceDetailClient.tsx"), "utf8"),
    readFile(path.join(root, "src/lib/email.ts"), "utf8"),
  ])
  assert.match(schema, /PROJECT_AMENDMENT_INVOICE_DELIVERY_PREPARED/)
  assert.match(route, /ACCESS_ROLES\.financeManagement/)
  assert.match(route, /FOR UPDATE/)
  assert.match(route, /AMENDMENT_INVOICE_DELIVERY_IN_PROGRESS/)
  assert.match(route, /PROJECT_AMENDMENT_INVOICE_DELIVERY_FAILED/)
  assert.match(client, /AquaConfirmDialog/)
  assert.match(email, /INVOICE_FROM/)
  assert.equal(
    safeInvoiceDeliveryFailure(new Error("RESEND_EMAIL_FAILED:422:private body")),
    "EMAIL_PROVIDER_FAILED:422",
  )
})
