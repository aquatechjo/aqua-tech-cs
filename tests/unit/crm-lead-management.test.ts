import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  canConvertLeadToOpportunity,
  isOpenLeadStatus,
  leadActionBucket,
  leadSourceToOpportunitySource,
  serviceRequestStatusFromLead,
} from "../../src/lib/crm-lead"

test("lead qualification keeps linked service requests synchronized", () => {
  assert.equal(serviceRequestStatusFromLead("NEW"), "NEW")
  assert.equal(serviceRequestStatusFromLead("DISCOVERY"), "CONTACTED")
  assert.equal(serviceRequestStatusFromLead("NEEDS_INFO"), "CONTACTED")
  assert.equal(serviceRequestStatusFromLead("QUALIFIED"), "QUALIFIED")
  assert.equal(serviceRequestStatusFromLead("DISQUALIFIED"), "REJECTED")
  assert.equal(serviceRequestStatusFromLead("DUPLICATE"), "ARCHIVED")
})

test("lead sources map safely into the narrower opportunity source contract", () => {
  assert.equal(leadSourceToOpportunitySource("WEBSITE"), "WEBSITE")
  assert.equal(leadSourceToOpportunitySource("WHATSAPP"), "WHATSAPP")
  assert.equal(leadSourceToOpportunitySource("REFERRAL"), "REFERRAL")
  assert.equal(leadSourceToOpportunitySource("CHATBOT"), "OTHER")
  assert.equal(leadSourceToOpportunitySource("EMAIL"), "OTHER")
  assert.equal(leadSourceToOpportunitySource("CAMPAIGN"), "OTHER")
})

test("lead attention state distinguishes overdue, upcoming, missing, and closed work", () => {
  const now = new Date("2026-07-29T18:00:00.000Z")

  assert.equal(
    leadActionBucket({
      status: "DISCOVERY",
      nextActionAt: "2026-07-29T17:59:59.000Z",
      now,
    }),
    "OVERDUE",
  )
  assert.equal(
    leadActionBucket({
      status: "QUALIFIED",
      nextActionAt: "2026-07-30T09:00:00.000Z",
      now,
    }),
    "UPCOMING",
  )
  assert.equal(
    leadActionBucket({
      status: "NEW",
      nextActionAt: null,
      now,
    }),
    "MISSING",
  )
  assert.equal(
    leadActionBucket({
      status: "CONVERTED",
      nextActionAt: null,
      now,
    }),
    "CLOSED",
  )
})

test("only qualified leads without an opportunity can enter the pipeline", () => {
  assert.equal(isOpenLeadStatus("DISCOVERY"), true)
  assert.equal(isOpenLeadStatus("CONVERTED"), false)
  assert.equal(
    canConvertLeadToOpportunity({
      status: "QUALIFIED",
      hasOpportunity: false,
    }),
    true,
  )
  assert.equal(
    canConvertLeadToOpportunity({
      status: "DISCOVERY",
      hasOpportunity: false,
    }),
    false,
  )
  assert.equal(
    canConvertLeadToOpportunity({
      status: "QUALIFIED",
      hasOpportunity: true,
    }),
    false,
  )
})

test("CRM-02 applies server-side access, canonical workflow UI, and safe confirmations", () => {
  const page = readFileSync(
    "src/app/dashboard/leads/page.tsx",
    "utf8",
  )
  const client = readFileSync(
    "src/app/dashboard/leads/LeadsClient.tsx",
    "utf8",
  )
  const collectionRoute = readFileSync(
    "src/app/api/leads/route.ts",
    "utf8",
  )
  const detailRoute = readFileSync(
    "src/app/api/leads/[id]/route.ts",
    "utf8",
  )
  const conversionRoute = readFileSync(
    "src/app/api/leads/[id]/convert/route.ts",
    "utf8",
  )
  const dashboardLayout = readFileSync(
    "src/app/dashboard/layout.tsx",
    "utf8",
  )

  assert.match(page, /ACCESS_ROLES\.salesRead/)
  assert.match(page, /AquaPagination/)
  assert.match(page, /possibleDuplicateOf/)
  assert.match(client, /AquaFilterBar/)
  assert.match(client, /AquaDataPanel/)
  assert.match(client, /mobileStrategy="stack"/)
  assert.match(client, /AquaModal/)
  assert.match(client, /AquaConfirmDialog/)
  assert.doesNotMatch(client, /window\.(confirm|prompt)/)
  assert.match(collectionRoute, /assertSameOrigin/)
  assert.match(collectionRoute, /ACCESS_ROLES\.salesManagement/)
  assert.match(detailRoute, /serviceRequestStatusFromLead/)
  assert.match(detailRoute, /LEAD_ALREADY_CONVERTED/)
  assert.match(conversionRoute, /LEAD_QUALIFICATION_REQUIRED/)
  assert.match(conversionRoute, /leadSourceToOpportunitySource/)
  assert.match(dashboardLayout, /href: "\/dashboard\/leads"/)
})
