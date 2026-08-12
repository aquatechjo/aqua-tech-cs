import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  amendmentInvoiceDocumentIssues,
  invoiceDocumentFileName,
} from "../../src/lib/project-amendment-invoice-document"

const issued = {
  status: "ISSUED",
  invoiceIssuedAt: new Date("2026-08-12T00:00:00Z"),
  issueDate: new Date("2026-08-12T00:00:00Z"),
  dueDate: new Date("2026-08-26T00:00:00Z"),
  issueReference: "FIN-APPROVAL-18",
  taxDecision: "TAX_EXEMPT",
}

test("allows a complete issued amendment invoice document", () => {
  assert.deepEqual(amendmentInvoiceDocumentIssues(issued), [])
  assert.deepEqual(amendmentInvoiceDocumentIssues({ ...issued, status: "PAID" }), [])
})

test("blocks draft, cancelled, and incomplete invoice documents", () => {
  assert.ok(amendmentInvoiceDocumentIssues({ ...issued, status: "DRAFT" }).length)
  assert.ok(amendmentInvoiceDocumentIssues({ ...issued, status: "CANCELLED" }).length)
  assert.ok(amendmentInvoiceDocumentIssues({ ...issued, dueDate: null }).length)
  assert.ok(amendmentInvoiceDocumentIssues({ ...issued, issueReference: "" }).length)
  assert.ok(amendmentInvoiceDocumentIssues({ ...issued, taxDecision: null }).length)
})

test("creates a bounded document filename", () => {
  assert.equal(invoiceDocumentFileName("INV/2026 001"), "INV-2026-001-amendment-invoice")
})

test("document route is authenticated, tenant scoped, no-index, and print ready", () => {
  const page = readFileSync("src/app/invoice-document/[id]/page.tsx", "utf8")
  const actions = readFileSync("src/app/invoice-document/[id]/InvoiceDocumentActions.tsx", "utf8")
  const detail = readFileSync("src/app/dashboard/finance/invoices/[id]/InvoiceDetailClient.tsx", "utf8")
  assert.match(page, /requireAuth\(\)/u)
  assert.match(page, /ACCESS_ROLES\.financeRead/u)
  assert.match(page, /companyId: user\.companyId/u)
  assert.match(page, /robots: \{ index: false, follow: false \}/u)
  assert.match(page, /AquaSystemDocument/u)
  assert.match(actions, /window\.print\(\)/u)
  assert.match(actions, /طباعة \/ حفظ PDF/u)
  assert.match(detail, /\/invoice-document\/\$\{invoice\.id\}/u)
})
