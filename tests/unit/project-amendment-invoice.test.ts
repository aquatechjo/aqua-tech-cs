import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"
import path from "node:path"

import {
  amendmentInvoiceDescription,
  amendmentInvoiceIssues,
} from "../../src/lib/project-amendment-invoice"

const valid = {
  status: "ACCEPTED",
  impactAppliedAt: new Date("2026-08-12T00:00:00Z"),
  invoiceId: null,
  amount: "250.00",
  amendmentCurrency: "JOD",
  projectCurrency: "JOD",
  clientId: "client-1",
}

test("allows one invoice handoff after accepted impact application", () => {
  assert.deepEqual(amendmentInvoiceIssues(valid), [])
})

test("blocks handoff before acceptance or impact application", () => {
  const issues = amendmentInvoiceIssues({
    ...valid,
    status: "SENT",
    impactAppliedAt: null,
  })
  assert.equal(issues.length, 2)
})

test("blocks duplicate, invalid amount, missing client, and currency mismatch", () => {
  const issues = amendmentInvoiceIssues({
    ...valid,
    invoiceId: "invoice-1",
    amount: "0.00",
    projectCurrency: "USD",
    clientId: null,
  })
  assert.equal(issues.length, 4)
})

test("builds a bounded traceable invoice description", () => {
  const description = amendmentInvoiceDescription("AMD-CR-2026-0001", "توسعة النطاق")
  assert.match(description, /AMD-CR-2026-0001/)
  assert.ok(description.length <= 300)
})

test("handoff is finance-owned, locked, unique, audited, and draft-only", async () => {
  const root = process.cwd()
  const [schema, migration, route, panel] = await Promise.all([
    readFile(path.join(root, "prisma/schema.prisma"), "utf8"),
    readFile(
      path.join(
        root,
        "prisma/migrations/20260812210000_proj_16_amendment_invoice_handoff/migration.sql",
      ),
      "utf8",
    ),
    readFile(
      path.join(
        root,
        "src/app/api/finance/project-amendments/[id]/invoice/route.ts",
      ),
      "utf8",
    ),
    readFile(
      path.join(
        root,
        "src/app/dashboard/projects/[id]/ProjectChangeRequestsPanel.tsx",
      ),
      "utf8",
    ),
  ])

  assert.match(schema, /invoiceId String\? @unique/)
  assert.match(migration, /ProjectContractAmendment_invoiceId_key/)
  assert.match(route, /ACCESS_ROLES\.financeManagement/)
  assert.match(route, /FOR UPDATE/)
  assert.match(route, /isolationLevel: "Serializable"/)
  assert.match(route, /status: "DRAFT"/)
  assert.match(route, /PROJECT_AMENDMENT_INVOICE_CREATED/)
  assert.match(panel, /canManageFinance/)
})
