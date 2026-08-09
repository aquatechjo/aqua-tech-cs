import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { feedbackPublicExpiry, isValidFeedbackPublicToken, publicFeedbackSubmissionSchema } from "../../src/lib/project-feedback"

test("PROJ-09 validates opaque tokens and bounded public input", () => {
  assert.equal(isValidFeedbackPublicToken("a".repeat(43)), true)
  assert.equal(isValidFeedbackPublicToken("short"), false)
  assert.equal(publicFeedbackSubmissionSchema.safeParse({ action: "SUBMIT", npsScore: 9, satisfactionScore: 5, feedbackSummary: "تجربة واضحة وممتازة في جميع مراحل المشروع", testimonialApproved: false }).success, true)
  assert.equal(publicFeedbackSubmissionSchema.safeParse({ action: "SUBMIT", npsScore: 9, satisfactionScore: 5, feedbackSummary: "تجربة واضحة وممتازة", testimonialApproved: true }).success, false)
})

test("PROJ-09 gives links a finite validity window", () => {
  const now = new Date("2026-08-09T00:00:00.000Z")
  assert.equal(feedbackPublicExpiry(now, 14).toISOString(), "2026-08-23T00:00:00.000Z")
})

test("PROJ-09 stores only hashes and governs one transactional submission", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8")
  const migration = readFileSync("prisma/migrations/20260809190000_proj_09_secure_client_feedback/migration.sql", "utf8")
  const route = readFileSync("src/app/api/public/feedback/[token]/route.ts", "utf8")
  assert.match(schema, /publicTokenHash\s+String\?\s+@unique/)
  assert.match(migration, /ProjectFeedback_public_access_check/)
  assert.match(route, /enforceRateLimit/)
  assert.match(route, /loadPublicFeedbackForUpdate/)
  assert.match(route, /isolationLevel: "Serializable"/)
  assert.match(route, /publicTokenHash: null/)
})

test("PROJ-09 exposes no-index public page and internal issue/revoke controls", () => {
  const page = readFileSync("src/app/feedback/[token]/page.tsx", "utf8")
  const linkRoute = readFileSync("src/app/api/projects/[id]/feedback/public-link/route.ts", "utf8")
  const panel = readFileSync("src/app/dashboard/projects/[id]/ProjectFeedbackPanel.tsx", "utf8")
  assert.match(page, /index: false/)
  assert.match(linkRoute, /FEEDBACK_OWNER_REQUIRED/)
  assert.match(linkRoute, /publicTokenHash: access.tokenHash/)
  assert.match(panel, /إصدار رابط لمدة 14 يومًا/)
})
