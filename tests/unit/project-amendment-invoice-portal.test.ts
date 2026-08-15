import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { invoicePortalExpiry, invoicePortalIsActive, invoicePortalIssues, invoicePortalPath, isValidInvoicePortalToken } from "../../src/lib/project-amendment-invoice-portal"
import { invoicePortalDeliveryIssues, invoicePortalDeliverySchema, portalDeliveryAttemptInProgress, safeInvoicePortalDeliveryFailure } from "../../src/lib/project-amendment-invoice-portal-delivery"
import { buildAmendmentInvoicePortalDeliveryEmail } from "../../src/lib/email-templates"

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

test("portal delivery validates recipient, issuance, and client ownership", () => {
  assert.equal(invoicePortalDeliverySchema.safeParse({ recipientName: "Client", recipientEmail: "CLIENT@EXAMPLE.COM", validDays: 14 }).success, true)
  assert.equal(invoicePortalDeliverySchema.safeParse({ recipientName: "C", recipientEmail: "bad", validDays: 31 }).success, false)
  const valid = { invoiceStatus: "ISSUED", invoiceIssuedAt: new Date(), issueDate: new Date(), dueDate: new Date(), issueReference: "FIN-21", clientId: "client-1", projectClientId: "client-1" }
  assert.deepEqual(invoicePortalDeliveryIssues(valid), [])
  assert.ok(invoicePortalDeliveryIssues({ ...valid, projectClientId: "client-2" }).length)
})

test("portal delivery blocks concurrent attempts and bounds provider failures", () => {
  const now = new Date("2026-08-15T18:00:00Z")
  assert.equal(portalDeliveryAttemptInProgress({ preparedAt: new Date("2026-08-15T17:55:00Z"), failedAt: null, sentAt: null, now }), true)
  assert.equal(portalDeliveryAttemptInProgress({ preparedAt: new Date("2026-08-15T17:40:00Z"), failedAt: null, sentAt: null, now }), false)
  assert.equal(safeInvoicePortalDeliveryFailure(new Error("RESEND_EMAIL_FAILED:429:private")), "EMAIL_PROVIDER_FAILED:429")
})

test("portal invitation email contains only a safe public link", () => {
  const email = buildAmendmentInvoicePortalDeliveryEmail({ recipientName: "<Client>", invoiceNumber: "INV-21", projectName: "Project", totalAmount: "120.00", currency: "JOD", dueDate: "2026-08-30", portalUrl: "https://app.example.com/invoice/token", validUntilLabel: "30 آب 2026" })
  assert.match(email.html, /https:\/\/app\.example\.com\/invoice\/token/u)
  assert.match(email.html, /&lt;Client&gt;/u)
  assert.doesNotMatch(email.html, /\/dashboard/u)
  assert.throws(() => buildAmendmentInvoicePortalDeliveryEmail({ recipientName: "Client", invoiceNumber: "INV", projectName: "Project", totalAmount: "1", currency: "JOD", dueDate: "2026-08-30", portalUrl: "javascript:alert(1)", validUntilLabel: "soon" }), /http or https/u)
})

test("PROJ-21 delivery route activates the new token only after email success", () => {
  const route = readFileSync("src/app/api/finance/invoices/[id]/portal/delivery/route.ts", "utf8")
  assert.match(route, /assertSameOrigin/u)
  assert.match(route, /ACCESS_ROLES\.financeManagement/u)
  assert.match(route, /INVOICE_PORTAL_DELIVERY_IN_PROGRESS/u)
  assert.match(route, /sendAmendmentInvoicePortalDeliveryEmail/u)
  assert.match(route, /invoicePortalTokenHash: access\.tokenHash/u)
  assert.match(route, /بقي الرابط السابق فعالًا/u)
})
