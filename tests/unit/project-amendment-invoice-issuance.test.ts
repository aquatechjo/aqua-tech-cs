import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

import {
  amendmentInvoiceEditIssues,
  amendmentInvoiceIssuanceIssues,
} from "../../src/lib/project-amendment-invoice-issuance"

const valid = {
  reference: "FIN-APPROVAL-2026-17",
  dueDate: new Date("2026-09-12T00:00:00Z"),
  taxDecision: "TAX_EXEMPT" as const,
  taxAmount: "0.00",
  subtotal: "250.00",
  discountAmount: "0.00",
  amendmentAmount: "250.00",
  currency: "JOD",
  amendmentCurrency: "JOD",
  projectId: "project-1",
  amendmentProjectId: "project-1",
  clientId: "client-1",
  projectClientId: "client-1",
  items: [{ quantity: "1.00", unitPrice: "250.00" }],
}

test("allows issuance with immutable base and complete evidence", () => {
  assert.deepEqual(amendmentInvoiceIssuanceIssues(valid), [])
})

test("requires due date, reference, and a coherent tax decision", () => {
  const issues = amendmentInvoiceIssuanceIssues({
    ...valid,
    reference: "",
    dueDate: null,
    taxDecision: "TAX_APPLIED",
  })
  assert.equal(issues.length, 3)
})

test("blocks amount, discount, currency, link, and line drift", () => {
  const issues = amendmentInvoiceIssuanceIssues({
    ...valid,
    subtotal: "200.00",
    discountAmount: "10.00",
    currency: "USD",
    clientId: "client-2",
    items: [{ quantity: "2.00", unitPrice: "100.00" }],
  })
  assert.equal(issues.length, 4)
})

test("allows only tax and operational text edits on amendment drafts", () => {
  assert.deepEqual(
    amendmentInvoiceEditIssues({
      itemsRequested: false,
      discountRequested: false,
      linksRequested: false,
    }),
    [],
  )
  assert.equal(
    amendmentInvoiceEditIssues({
      itemsRequested: true,
      discountRequested: true,
      linksRequested: true,
    }).length,
    3,
  )
})

test("issuance is locked, audited, constrained, and uses canonical confirmation", async () => {
  const root = process.cwd()
  const [schema, migration, route, client] = await Promise.all([
    readFile(path.join(root, "prisma/schema.prisma"), "utf8"),
    readFile(
      path.join(
        root,
        "prisma/migrations/20260812223000_proj_17_govern_amendment_invoice_issuance/migration.sql",
      ),
      "utf8",
    ),
    readFile(
      path.join(root, "src/app/api/finance/invoices/[id]/route.ts"),
      "utf8",
    ),
    readFile(
      path.join(
        root,
        "src/app/dashboard/finance/invoices/[id]/InvoiceDetailClient.tsx",
      ),
      "utf8",
    ),
  ])

  assert.match(schema, /PROJECT_AMENDMENT_INVOICE_ISSUED/)
  assert.match(migration, /invoiceIssuanceEvidence_check/)
  assert.match(route, /FOR UPDATE/)
  assert.match(route, /PROJECT_AMENDMENT_INVOICE_ISSUED/)
  assert.match(client, /AquaConfirmDialog/)
  assert.doesNotMatch(client, /window\.confirm/)
})
