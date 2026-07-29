import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  leadCompletionScore,
  leadIdentity,
  leadLifecycleDates,
  leadSourceFromServiceRequest,
  leadStatusFromServiceRequest,
  normalizeLeadCompany,
  normalizeLeadEmail,
  normalizeLeadPhone,
} from "../../src/lib/crm-lead"

test("lead identity normalization is deterministic without changing display data", () => {
  assert.equal(normalizeLeadEmail("  Sales@Example.COM "), "sales@example.com")
  assert.equal(normalizeLeadPhone(" +962 (79) 123-4567 "), "962791234567")
  assert.equal(
    normalizeLeadCompany("  Aqua   Client  "),
    "aqua client",
  )
  assert.equal(normalizeLeadEmail(" "), null)
  assert.equal(normalizeLeadPhone(null), null)

  assert.deepEqual(
    leadIdentity({
      email: " INFO@EXAMPLE.COM ",
      phone: "079 000 0000",
      companyName: "  Example   Co ",
    }),
    {
      emailNormalized: "info@example.com",
      phoneNormalized: "0790000000",
      companyNormalized: "example co",
    },
  )
})

test("lead completion score rewards captured facts and remains bounded", () => {
  assert.equal(
    leadCompletionScore({
      contactName: "Qusai",
      email: "q@example.com",
      companyName: "Example",
      serviceType: "Website",
      message: "Need a bilingual site",
      budgetRange: "1000-1500",
      timeline: "4 weeks",
      contactConsent: true,
    }),
    100,
  )

  assert.equal(
    leadCompletionScore({
      contactName: "Qusai",
      serviceType: "Website",
    }),
    35,
  )
})

test("service request state maps into lead qualification without skipping review", () => {
  assert.equal(leadSourceFromServiceRequest("WEBSITE"), "WEBSITE")
  assert.equal(leadSourceFromServiceRequest("MANUAL"), "MANUAL")
  assert.equal(leadStatusFromServiceRequest("NEW"), "NEW")
  assert.equal(leadStatusFromServiceRequest("PROPOSAL_SENT"), "QUALIFIED")
  assert.equal(leadStatusFromServiceRequest("REJECTED"), "DISQUALIFIED")
  assert.equal(leadStatusFromServiceRequest("CONVERTED"), "CONVERTED")
})

test("lead lifecycle dates only stamp the matching terminal milestone", () => {
  const now = new Date("2026-07-29T16:00:00.000Z")

  assert.deepEqual(leadLifecycleDates("QUALIFIED", now), {
    qualifiedAt: now,
    disqualifiedAt: null,
    convertedAt: null,
    archivedAt: null,
  })
  assert.deepEqual(leadLifecycleDates("NEW", now), {
    qualifiedAt: null,
    disqualifiedAt: null,
    convertedAt: null,
    archivedAt: null,
  })
})

test("CRM-01 creates leads transactionally for manual and website intake", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8")
  const migration = readFileSync(
    "prisma/migrations/20260729190000_crm_01_lead_intake_foundation/migration.sql",
    "utf8",
  )
  const manualRoute = readFileSync(
    "src/app/api/service-requests/route.ts",
    "utf8",
  )
  const publicRoute = readFileSync(
    "src/app/api/public/service-requests/route.ts",
    "utf8",
  )
  const conversionRoute = readFileSync(
    "src/app/api/sales/opportunities/from-service-request/route.ts",
    "utf8",
  )
  const requestUpdateRoute = readFileSync(
    "src/app/api/service-requests/[id]/route.ts",
    "utf8",
  )
  const requestConversionRoute = readFileSync(
    "src/app/api/service-requests/[id]/convert/route.ts",
    "utf8",
  )
  const opportunityConversionRoute = readFileSync(
    "src/app/api/sales/opportunities/[id]/convert/route.ts",
    "utf8",
  )

  assert.match(schema, /model Lead \{/)
  assert.match(schema, /possibleDuplicateOfId String\?/)
  assert.match(schema, /completionScore\s+Int/)
  assert.match(schema, /contactConsent\s+Boolean\?/)
  assert.match(migration, /INSERT INTO "Lead"/)
  assert.match(migration, /Lead_completion_score_check/)
  assert.match(manualRoute, /createLeadForServiceRequest/)
  assert.match(publicRoute, /leadId: serviceRequest\.lead\.id/)
  assert.match(conversionRoute, /leadId: lead\?\.id \?\? null/)
  assert.match(requestUpdateRoute, /syncLeadForServiceRequest/)
  assert.match(requestConversionRoute, /leadId: lead\.id/)
  assert.match(opportunityConversionRoute, /leadId = lead\.id/)
})
