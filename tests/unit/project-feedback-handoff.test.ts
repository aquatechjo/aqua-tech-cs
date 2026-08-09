import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { feedbackTaskPriority, projectFeedbackMutationSchema } from "../../src/lib/project-feedback"

test("PROJ-08 requires an owned action for every low score", () => {
  const lowScore = { action: "RECORD", npsScore: 4, satisfactionScore: 4, feedbackSummary: "النتيجة تحتاج إلى متابعة واضحة", testimonialApproved: false, followUpRequired: false }
  assert.equal(projectFeedbackMutationSchema.safeParse(lowScore).success, false)
  assert.equal(projectFeedbackMutationSchema.safeParse({ ...lowScore, followUpAction: "مراجعة الملاحظات مع العميل", followUpDueAt: "2026-08-20T09:00:00.000Z", ownerId: "user-1" }).success, true)
})

test("PROJ-08 derives actionable task priority", () => {
  assert.equal(feedbackTaskPriority({ npsScore: 3, satisfactionScore: 4 }), "URGENT")
  assert.equal(feedbackTaskPriority({ npsScore: 6, satisfactionScore: 3 }), "HIGH")
})

test("PROJ-08 persistence and idempotent handoff contracts exist", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8")
  const migration = readFileSync("prisma/migrations/20260809050000_proj_08_feedback_task_handoff/migration.sql", "utf8")
  const route = readFileSync("src/app/api/projects/[id]/feedback/route.ts", "utf8")
  assert.match(schema, /followUpTaskId String\? @unique/)
  assert.match(migration, /PROJECT_FEEDBACK_TASK_CREATED/)
  assert.match(route, /ACTIVE_FEEDBACK_TASK_EXISTS/)
  assert.match(route, /FEEDBACK_TASK_NOT_COMPLETED/)
  assert.match(route, /source: "PROJECT_FEEDBACK"/)
  assert.match(route, /isolationLevel: "Serializable"/)
})

test("PROJ-08 exposes linked work in the feedback panel", () => {
  const page = readFileSync("src/app/dashboard/projects/[id]/page.tsx", "utf8")
  const panel = readFileSync("src/app/dashboard/projects/[id]/ProjectFeedbackPanel.tsx", "utf8")
  assert.match(page, /followUpTask:/)
  assert.match(panel, /مهمة المتابعة المرتبطة/)
})
