import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { invoicePortalExpiry, invoicePortalIsActive, invoicePortalIssues, invoicePortalPath, isValidInvoicePortalToken } from "../../src/lib/project-amendment-invoice-portal"

test("portal tokens and paths are opaque and bounded", () => {
  const token = "A".repeat(43)
  assert.equal(isValidInvoicePortalToken(token), true)
  assert.equal(isValidInvoicePortalToken("short"), false)
  assert.equal(invoicePortalPath(token), `/invoice/${token}`)
  assert.equal(invoicePortalExpiry(new Date("2026-08-13T00:00:00Z"), 14).toISOString(), "2026-08-27T00:00:00.000Z")
})

test("portal requires complete non-cancelled issuance", () => {
  const valid = { invoiceStatus: "ISSUED", invoiceIssuedAt: new Date(), issueDate: new Date(), dueDate: new Date(), issueReference: "FIN-20" }
  assert.deepEqual(invoicePortalIssues(valid), [])
  assert.ok(invoicePortalIssues({ ...valid, invoiceStatus: "DRAFT" }).length)
  assert.ok(invoicePortalIssues({ ...valid, invoiceStatus: "CANCELLED" }).length)
  assert.ok(invoicePortalIssues({ ...valid, dueDate: null }).length)
})

test("active state requires hash future expiry and no revocation", () => {
  const now = new Date("2026-08-13T00:00:00Z")
  assert.equal(invoicePortalIsActive({ tokenHash: "hash", expiresAt: new Date("2026-08-14T00:00:00Z"), revokedAt: null }, now), true)
  assert.equal(invoicePortalIsActive({ tokenHash: "hash", expiresAt: new Date("2026-08-12T00:00:00Z"), revokedAt: null }, now), false)
  assert.equal(invoicePortalIsActive({ tokenHash: "hash", expiresAt: new Date("2026-08-14T00:00:00Z"), revokedAt: now }, now), false)
})

test("portal is hash-only, tenant-governed, audited, no-index, and client-safe", () => {
  const route = readFileSync("src/app/api/finance/invoices/[id]/portal/route.ts", "utf8")
  const server = readFileSync("src/lib/project-amendment-invoice-portal-server.ts", "utf8")
  const page = readFileSync("src/app/invoice/[token]/page.tsx", "utf8")
  assert.match(route, /assertSameOrigin/u)
  assert.match(route, /ACCESS_ROLES\.financeManagement/u)
  assert.match(route, /companyId: user\.companyId/u)
  assert.match(route, /FOR UPDATE/u)
  assert.match(server, /hashOpaqueValue\(token\)/u)
  assert.doesNotMatch(server, /invoicePortalToken:\s*token/u)
  assert.match(page, /index: false, follow: false, nocache: true/u)
  assert.doesNotMatch(page, /dashboard/u)
})
