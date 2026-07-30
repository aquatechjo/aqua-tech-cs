import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { buildProposalDeliveryEmail } from "../../src/lib/email-templates"
import {
  displayProposalLifecycleStatus,
  isProposalPublicAccessActive,
  isValidProposalPublicToken,
  normalizedWhatsappNumber,
  proposalClientResponseSchema,
  proposalDecisionForAction,
  proposalValidUntil,
  proposalWhatsappUrl,
  proposalWorkspaceStatusForDecision,
  publicProposalPath,
} from "../../src/lib/proposal-delivery"

test("proposal public tokens and validity windows are strict", () => {
  const token = "A".repeat(43)
  const startedAt = new Date("2026-07-31T09:00:00.000Z")

  assert.equal(isValidProposalPublicToken(token), true)
  assert.equal(isValidProposalPublicToken("short"), false)
  assert.equal(publicProposalPath(token), `/proposal/${token}`)
  assert.equal(
    proposalValidUntil({ startedAt, validityDays: 30 }).toISOString(),
    "2026-08-30T09:00:00.000Z",
  )
  assert.throws(
    () => proposalValidUntil({ startedAt, validityDays: 0 }),
    /INVALID_PROPOSAL_VALIDITY/,
  )
})

test("proposal expiry uses the company local calendar date", () => {
  const now = new Date("2026-07-31T21:30:00.000Z")
  const validUntil = new Date("2026-07-31T20:00:00.000Z")

  assert.equal(
    displayProposalLifecycleStatus({
      status: "SENT",
      validUntil,
      now,
      timeZone: "Asia/Amman",
    }),
    "EXPIRED",
  )
  assert.equal(
    displayProposalLifecycleStatus({
      status: "SENT",
      validUntil,
      now,
      timeZone: "UTC",
    }),
    "SENT",
  )
})

test("public access is bound to the exact sent version and client hash", () => {
  const base = {
    deliveryStatus: "SENT",
    revokedAt: null,
    expiresAt: new Date("2026-08-30T09:00:00.000Z"),
    workspaceStatus: "SENT" as const,
    deliveryVersion: 3,
    sentVersion: 3,
    deliveryClientContentHash: "client-hash-v3",
    sentClientContentHash: "client-hash-v3",
    now: new Date("2026-08-01T09:00:00.000Z"),
    timeZone: "Asia/Amman",
  }

  assert.equal(isProposalPublicAccessActive(base), true)
  assert.equal(
    isProposalPublicAccessActive({
      ...base,
      deliveryVersion: 2,
    }),
    false,
  )
  assert.equal(
    isProposalPublicAccessActive({
      ...base,
      deliveryClientContentHash: "stale-hash",
    }),
    false,
  )
  assert.equal(
    isProposalPublicAccessActive({
      ...base,
      revokedAt: new Date("2026-08-01T08:00:00.000Z"),
    }),
    false,
  )
  assert.equal(
    isProposalPublicAccessActive({
      ...base,
      deliveryStatus: "PREPARED",
    }),
    false,
  )
})

test("client decisions require identity, authority, and actionable notes", () => {
  const identity = {
    responderName: "مدير العميل",
    responderEmail: "client@example.com",
    responderTitle: "المدير العام",
    authorityConfirmed: true,
  } as const

  assert.equal(
    proposalClientResponseSchema.safeParse({
      action: "ACCEPT",
      ...identity,
    }).success,
    true,
  )
  assert.equal(
    proposalClientResponseSchema.safeParse({
      action: "REJECT",
      ...identity,
      authorityConfirmed: false,
      notes: "سبب واضح ومفصل للرفض",
    }).success,
    false,
  )
  assert.equal(
    proposalClientResponseSchema.safeParse({
      action: "REQUEST_CHANGES",
      ...identity,
      notes: "قصير",
    }).success,
    false,
  )
  assert.equal(proposalDecisionForAction("ACCEPT"), "ACCEPTED")
  assert.equal(
    proposalWorkspaceStatusForDecision("CHANGES_REQUESTED"),
    "CLIENT_CHANGES_REQUESTED",
  )
})

test("WhatsApp delivery normalizes E.164-style digits without persisting a message", () => {
  assert.equal(normalizedWhatsappNumber("+962 79 123 4567"), "962791234567")
  assert.throws(
    () => normalizedWhatsappNumber("123"),
    /INVALID_WHATSAPP_NUMBER/,
  )

  const url = proposalWhatsappUrl({
    phone: "+962 79 123 4567",
    proposalUrl: "https://example.com/proposal/secure-token",
    proposalNumber: "PROP-0007",
    recipientName: "شركة مثال",
  })

  assert.match(url, /^https:\/\/wa\.me\/962791234567\?text=/)
  assert.match(decodeURIComponent(url), /PROP-0007/)
  assert.match(decodeURIComponent(url), /secure-token/)
})

test("proposal delivery email escapes customer content and requires a web URL", () => {
  const email = buildProposalDeliveryEmail({
    recipientName: "<script>alert(1)</script>",
    proposalNumber: "PROP-0007",
    proposalTitle: "<strong>عنوان</strong>",
    proposalUrl: "https://example.com/proposal/secure-token",
    validUntilLabel: "30 آب 2026",
  })

  assert.doesNotMatch(email.html, /<script>alert\(1\)<\/script>/)
  assert.doesNotMatch(email.html, /<strong>عنوان<\/strong>/)
  assert.match(email.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
  assert.match(email.html, /&lt;strong&gt;عنوان&lt;\/strong&gt;/)
  assert.throws(
    () =>
      buildProposalDeliveryEmail({
        recipientName: "عميل",
        proposalNumber: "PROP-0007",
        proposalTitle: "عرض",
        proposalUrl: "javascript:alert(1)",
        validUntilLabel: "30 آب 2026",
      }),
    /http or https/,
  )
})

test("PROP-02 delivery and response routes are scoped, locked, and auditable", () => {
  const deliveryRoute = readFileSync(
    resolve(
      process.cwd(),
      "src/app/api/discovery/sessions/[id]/proposal/deliver/route.ts",
    ),
    "utf8",
  )
  const publicRoute = readFileSync(
    resolve(
      process.cwd(),
      "src/app/api/public/proposals/[token]/route.ts",
    ),
    "utf8",
  )
  const publicServer = readFileSync(
    resolve(process.cwd(), "src/lib/proposal-delivery-server.ts"),
    "utf8",
  )
  const publicPage = readFileSync(
    resolve(process.cwd(), "src/app/proposal/[token]/page.tsx"),
    "utf8",
  )
  const saveRoute = readFileSync(
    resolve(
      process.cwd(),
      "src/app/api/discovery/sessions/[id]/proposal/route.ts",
    ),
    "utf8",
  )
  const convertRoute = readFileSync(
    resolve(
      process.cwd(),
      "src/app/api/sales/opportunities/[id]/convert/route.ts",
    ),
    "utf8",
  )
  const migration = readFileSync(
    resolve(
      process.cwd(),
      "prisma/migrations/20260731030000_prop_02_proposal_delivery_decisions/migration.sql",
    ),
    "utf8",
  )

  assert.match(deliveryRoute, /assertSameOrigin\(request\)/)
  assert.match(deliveryRoute, /ACCESS_ROLES\.proposalDelivery/)
  assert.match(deliveryRoute, /companyId: user\.companyId/)
  assert.match(deliveryRoute, /FOR UPDATE/)
  assert.match(deliveryRoute, /clientContentHash/)
  assert.match(deliveryRoute, /PROPOSAL_SENT/)
  assert.match(publicRoute, /assertSameOrigin\(request\)/)
  assert.match(publicRoute, /enforceRateLimit/)
  assert.match(publicRoute, /loadPublicProposalForUpdate/)
  assert.match(publicRoute, /PROPOSAL_RESPONSE_STATEMENT_VERSION/)
  assert.match(publicServer, /clientSafeProposalProjection/)
  assert.match(publicServer, /APP_ORIGIN is required in production/)
  assert.match(publicPage, /index: false/)
  assert.match(publicPage, /referrer: "no-referrer"/)
  assert.match(saveRoute, /CLIENT_CHANGES_REQUESTED/)

  for (const source of [deliveryRoute, publicRoute]) {
    assert.doesNotMatch(source, /project\.(create|upsert)/)
    assert.doesNotMatch(source, /createProjectWithWorkflow/)
  }

  assert.match(convertRoute, /CENTRAL_PROPOSAL_PROJECT_CONVERSION_PENDING/)
  assert.ok(
    convertRoute.indexOf(
      "CENTRAL_PROPOSAL_PROJECT_CONVERSION_PENDING",
    ) < convertRoute.indexOf("createProjectWithWorkflow(tx"),
  )
  assert.match(migration, /"tokenHash" TEXT NOT NULL/)
  assert.doesNotMatch(migration, /"token" TEXT/)
  assert.doesNotMatch(migration, /\bDROP\b/i)
})
