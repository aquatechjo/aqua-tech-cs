import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { assertFeedbackTransition, feedbackStatus, projectFeedbackMutationSchema } from "../../src/lib/project-feedback"

test("PROJ-07 validates scores, evidence, consent and owned follow-up", () => {
  assert.equal(projectFeedbackMutationSchema.safeParse({ action: "RECORD", npsScore: 11, satisfactionScore: 5, feedbackSummary: "تجربة ممتازة جدًا" }).success, false)
  assert.equal(projectFeedbackMutationSchema.safeParse({ action: "RECORD", npsScore: 9, satisfactionScore: 5, feedbackSummary: "تم التسليم بجودة عالية وفي الوقت المتفق عليه", testimonialApproved: false, followUpRequired: false }).success, true)
  assert.equal(projectFeedbackMutationSchema.safeParse({ action: "RECORD", npsScore: 9, satisfactionScore: 5, feedbackSummary: "تم التسليم بجودة عالية وفي الوقت المتفق عليه", testimonialApproved: true, followUpRequired: false }).success, false)
})

test("low scores and explicit follow-up require governed action", () => {
  assert.equal(feedbackStatus({ npsScore: 6, satisfactionScore: 5, followUpRequired: false }), "ACTION_REQUIRED")
  assert.equal(feedbackStatus({ npsScore: 10, satisfactionScore: 5, followUpRequired: false }), "RECEIVED")
})

test("feedback resolution follows the lifecycle", () => {
  assert.doesNotThrow(() => assertFeedbackTransition(null, "RECORD"))
  assert.doesNotThrow(() => assertFeedbackTransition("ACTION_REQUIRED", "RESOLVE"))
  assert.throws(() => assertFeedbackTransition("RECEIVED", "RESOLVE"), /PROJECT_FEEDBACK_TRANSITION_NOT_ALLOWED/)
})

test("PROJ-07 persistence, locking, UI and audit contracts exist", () => {
  const migration = readFileSync("prisma/migrations/20260809020000_proj_07_client_feedback/migration.sql", "utf8")
  const route = readFileSync("src/app/api/projects/[id]/feedback/route.ts", "utf8")
  const panel = readFileSync("src/app/dashboard/projects/[id]/ProjectFeedbackPanel.tsx", "utf8")
  assert.match(migration, /ProjectFeedback_follow_up_check/)
  assert.match(route, /FOR UPDATE/)
  assert.match(route, /isolationLevel: "Serializable"/)
  assert.match(panel, /موافقة العميل على نشر الشهادة/)
})
