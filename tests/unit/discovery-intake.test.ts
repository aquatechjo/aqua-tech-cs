import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  canSubmitDiscoveryForReview,
  discoveryCompletionScore,
  discoveryQuestionsForTrack,
  inferDiscoveryServiceTrack,
  isDiscoveryLeadEligible,
  missingDiscoveryQuestions,
  shouldReopenDiscoveryGap,
  type DiscoveryAnswerValue,
} from "../../src/lib/discovery-intake"

test("discovery selects a stable question track from the requested service", () => {
  assert.equal(
    inferDiscoveryServiceTrack("Website Development"),
    "WEBSITE_COMMERCE",
  )
  assert.equal(
    inferDiscoveryServiceTrack("نظام إدارة داخلي SaaS"),
    "SOFTWARE_SAAS",
  )
  assert.equal(
    inferDiscoveryServiceTrack("n8n AI automation"),
    "AUTOMATION_AI",
  )
  assert.equal(
    inferDiscoveryServiceTrack("خطة تسويق ونمو"),
    "MARKETING_GROWTH",
  )
  assert.equal(inferDiscoveryServiceTrack("استشارة عامة"), "GENERAL")
})

test("completion counts verified facts and approved decisions only", () => {
  const track = "GENERAL" as const
  const questions = discoveryQuestionsForTrack(track)
  const answers: DiscoveryAnswerValue[] = questions.map(
    (question, index) => ({
      questionKey: question.key,
      value: `إجابة ${index + 1}`,
      source:
        index === 0
          ? "INTERNAL_NOTE"
          : index === 1
            ? "AI_INFERENCE"
            : "CUSTOMER_FACT",
      isUnknown: index === 2,
    }),
  )
  const missing = missingDiscoveryQuestions({ track, answers })

  assert.equal(missing.length, 3)
  assert.equal(
    discoveryCompletionScore({ track, answers }),
    Math.round(((questions.length - 3) / questions.length) * 100),
  )
})

test("review readiness requires answers or explicit gap waivers", () => {
  const track = "GENERAL" as const
  const questions = discoveryQuestionsForTrack(track)
  const answers: DiscoveryAnswerValue[] = questions
    .slice(1)
    .map((question) => ({
      questionKey: question.key,
      value: "إجابة موثقة من العميل",
      source: "CUSTOMER_FACT",
      isUnknown: false,
    }))

  assert.equal(
    canSubmitDiscoveryForReview({
      track,
      answers,
      waivedQuestionKeys: [],
    }),
    false,
  )
  assert.equal(
    canSubmitDiscoveryForReview({
      track,
      answers,
      waivedQuestionKeys: [questions[0].key],
    }),
    true,
  )
})

test("discovery allows converted leads only when an opportunity exists", () => {
  assert.equal(
    isDiscoveryLeadEligible({
      status: "CONTACTED",
      hasOpportunity: false,
    }),
    true,
  )
  assert.equal(
    isDiscoveryLeadEligible({
      status: "CONVERTED",
      hasOpportunity: false,
    }),
    false,
  )
  assert.equal(
    isDiscoveryLeadEligible({
      status: "CONVERTED",
      hasOpportunity: true,
    }),
    true,
  )
  assert.equal(
    isDiscoveryLeadEligible({
      status: "DISQUALIFIED",
      hasOpportunity: false,
    }),
    false,
  )
})

test("service-track changes never create a permanent implicit waiver", () => {
  assert.equal(
    shouldReopenDiscoveryGap({
      status: "WAIVED",
      resolution: "تم استبعاد السؤال بعد تغيير مسار الخدمة.",
    }),
    true,
  )
  assert.equal(
    shouldReopenDiscoveryGap({
      status: "WAIVED",
      resolution: "وافق مدير المبيعات على المتابعة لعدم توفر المعلومة.",
    }),
    false,
  )
  assert.equal(
    shouldReopenDiscoveryGap({
      status: "RESOLVED",
      resolution: "تمت الإجابة سابقًا.",
    }),
    true,
  )
})

test("DISC-01 is tenant-scoped, auditable, and uses canonical workflow surfaces", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8")
  const migration = readFileSync(
    "prisma/migrations/20260729233000_disc_01_discovery_intake_foundation/migration.sql",
    "utf8",
  )
  const collectionRoute = readFileSync(
    "src/app/api/discovery/sessions/route.ts",
    "utf8",
  )
  const detailRoute = readFileSync(
    "src/app/api/discovery/sessions/[id]/route.ts",
    "utf8",
  )
  const gapRoute = readFileSync(
    "src/app/api/discovery/sessions/[id]/gaps/[gapId]/route.ts",
    "utf8",
  )
  const listPage = readFileSync(
    "src/app/dashboard/discovery/page.tsx",
    "utf8",
  )
  const listClient = readFileSync(
    "src/app/dashboard/discovery/DiscoverySessionsClient.tsx",
    "utf8",
  )
  const detailPage = readFileSync(
    "src/app/dashboard/discovery/[id]/page.tsx",
    "utf8",
  )
  const detailClient = readFileSync(
    "src/app/dashboard/discovery/[id]/DiscoveryIntakeClient.tsx",
    "utf8",
  )

  assert.match(schema, /model IntakeSession \{/)
  assert.match(schema, /model IntakeAnswer \{/)
  assert.match(schema, /model RequirementGap \{/)
  assert.match(schema, /leadId String @unique/)
  assert.match(migration, /IntakeSession_completionScore_check/)
  assert.match(collectionRoute, /ACCESS_ROLES\.discoveryManagement/)
  assert.match(collectionRoute, /FOR UPDATE/)
  assert.match(collectionRoute, /companyId: user\.companyId/)
  assert.match(detailRoute, /assertSameOrigin/)
  assert.match(detailRoute, /DISCOVERY_SESSION_LOCKED/)
  assert.match(gapRoute, /resolution: z\.string\(\)\.trim\(\)\.min\(10\)/)
  assert.match(gapRoute, /DISCOVERY_GAP_WAIVED/)
  assert.match(listPage, /ACCESS_ROLES\.discoveryRead/)
  assert.match(listClient, /AquaFilterBar/)
  assert.match(listClient, /mobileStrategy="stack"/)
  assert.match(detailPage, /companyId: user\.companyId/)
  assert.match(detailClient, /AquaTabs/)
  assert.match(detailClient, /AquaFormSection/)
  assert.match(detailClient, /AquaModal/)
  assert.doesNotMatch(detailClient, /window\.(confirm|prompt)/)
})
