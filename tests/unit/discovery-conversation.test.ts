import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  isPublicDiscoveryAccessActive,
  isValidDiscoveryPublicToken,
  publicDiscoveryPhase,
  publicDiscoveryQuestionQueue,
  publicDiscoveryResponseProgress,
} from "../../src/lib/discovery-conversation"
import {
  discoveryQuestionsForTrack,
  type DiscoveryAnswerValue,
} from "../../src/lib/discovery-intake"

test("public discovery advances one unanswered question at a time", () => {
  const track = "GENERAL" as const
  const questions = discoveryQuestionsForTrack(track)
  const answers: DiscoveryAnswerValue[] = [
    {
      questionKey: questions[0].key,
      value: "نشاط خدمات مهنية",
      source: "CUSTOMER_FACT",
      isUnknown: false,
    },
    {
      questionKey: questions[1].key,
      value: "لا أعرف",
      source: "CUSTOMER_FACT",
      isUnknown: true,
    },
    {
      questionKey: questions[2].key,
      value: "ملاحظة داخلية لا تظهر للعميل",
      source: "INTERNAL_NOTE",
      isUnknown: false,
    },
  ]
  const queue = publicDiscoveryQuestionQueue({ track, answers })

  assert.equal(queue.length, questions.length - 3)
  assert.equal(queue[0].key, questions[3].key)
  assert.equal(
    publicDiscoveryResponseProgress({ track, answers }),
    Math.round((3 / questions.length) * 100),
  )
})

test("public discovery preserves consent, questions, summary, and submitted phases", () => {
  const track = "GENERAL" as const
  const questions = discoveryQuestionsForTrack(track)
  const answers: DiscoveryAnswerValue[] = questions.map((question) => ({
    questionKey: question.key,
    value: "إجابة من العميل",
    source: "CUSTOMER_FACT",
    isUnknown: false,
  }))

  assert.equal(
    publicDiscoveryPhase({
      started: false,
      submitted: false,
      track,
      answers: [],
    }),
    "CONSENT",
  )
  assert.equal(
    publicDiscoveryPhase({
      started: true,
      submitted: false,
      track,
      answers: [],
    }),
    "QUESTIONS",
  )
  assert.equal(
    publicDiscoveryPhase({
      started: true,
      submitted: false,
      track,
      answers,
    }),
    "SUMMARY",
  )
  assert.equal(
    publicDiscoveryPhase({
      started: true,
      submitted: true,
      track,
      answers,
    }),
    "SUBMITTED",
  )
})

test("public discovery tokens and expiry checks reject invalid access", () => {
  const now = new Date("2026-07-30T00:00:00.000Z")
  const validToken = "a".repeat(43)

  assert.equal(isValidDiscoveryPublicToken(validToken), true)
  assert.equal(isValidDiscoveryPublicToken("short"), false)
  assert.equal(
    isPublicDiscoveryAccessActive({
      expiresAt: new Date("2026-07-31T00:00:00.000Z"),
      revokedAt: null,
      sessionStatus: "COLLECTING",
      now,
    }),
    true,
  )
  assert.equal(
    isPublicDiscoveryAccessActive({
      expiresAt: new Date("2026-07-29T00:00:00.000Z"),
      revokedAt: null,
      sessionStatus: "COLLECTING",
      now,
    }),
    false,
  )
  assert.equal(
    isPublicDiscoveryAccessActive({
      expiresAt: new Date("2026-07-31T00:00:00.000Z"),
      revokedAt: now,
      sessionStatus: "COLLECTING",
      now,
    }),
    false,
  )
  assert.equal(
    isPublicDiscoveryAccessActive({
      expiresAt: new Date("2026-07-31T00:00:00.000Z"),
      revokedAt: null,
      sessionStatus: "ARCHIVED",
      now,
    }),
    false,
  )
})

test("DISC-02 keeps public access hashed, scoped, rate-limited, and reviewable", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8")
  const migration = readFileSync(
    "prisma/migrations/20260730003000_disc_02_conversational_discovery/migration.sql",
    "utf8",
  )
  const linkRoute = readFileSync(
    "src/app/api/discovery/sessions/[id]/public-link/route.ts",
    "utf8",
  )
  const publicRoute = readFileSync(
    "src/app/api/public/discovery/[token]/route.ts",
    "utf8",
  )
  const publicPage = readFileSync(
    "src/app/discovery/[token]/page.tsx",
    "utf8",
  )
  const publicClient = readFileSync(
    "src/app/discovery/[token]/PublicDiscoveryConversation.tsx",
    "utf8",
  )
  const internalClient = readFileSync(
    "src/app/dashboard/discovery/[id]/DiscoveryIntakeClient.tsx",
    "utf8",
  )
  const publicStyles = readFileSync(
    "src/styles/aqua-discovery-public.css",
    "utf8",
  )

  assert.match(schema, /model ConversationMessage \{/)
  assert.match(schema, /publicAccessTokenHash\s+String\?\s+@unique/)
  assert.match(schema, /@@unique\(\[intakeSessionId, sequence\]\)/)
  assert.match(migration, /ConversationMessage_intakeSessionId_fkey/)
  assert.match(linkRoute, /createDiscoveryPublicAccess/)
  assert.match(linkRoute, /ACCESS_ROLES\.discoveryManagement/)
  assert.match(linkRoute, /FOR UPDATE/)
  assert.doesNotMatch(
    linkRoute,
    /metadata:\s*\{[^}]*\b(token|path)\s*:/,
  )
  assert.match(publicRoute, /assertSameOrigin/)
  assert.match(publicRoute, /enforceRateLimit/)
  assert.match(publicRoute, /hashOpaqueValue\(token\)/)
  assert.match(publicRoute, /source: "CUSTOMER_FACT"/)
  assert.match(publicRoute, /DISCOVERY_PUBLIC_ANSWER_NOT_EDITABLE/)
  assert.match(publicRoute, /actorUserId: null/)
  assert.match(publicRoute, /DISCOVERY_CONVERSATION_SUBMITTED/)
  assert.doesNotMatch(publicRoute, /requireAuth/)
  assert.match(publicPage, /index: false/)
  assert.match(publicPage, /referrer: "no-referrer"/)
  assert.match(publicClient, /privacyConsent/)
  assert.match(publicClient, /contactConfirmed/)
  assert.match(publicClient, /session\.nextQuestion/)
  assert.match(publicClient, /راجع إجاباتك قبل الإرسال/)
  assert.match(publicClient, /أحتاج مساعدة من موظف/)
  assert.match(internalClient, /AquaConfirmDialog/)
  assert.match(internalClient, /إصدار رابط بديل/)
  assert.doesNotMatch(internalClient, /window\.(confirm|prompt)/)
  assert.match(publicStyles, /margin-inline/)
  assert.match(publicStyles, /border-start-(start|end)-radius/)
  assert.match(publicStyles, /prefers-reduced-motion/)
  assert.match(publicStyles, /max-width: 767\.98px/)
})
