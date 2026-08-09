import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { buildProjectFeedbackInvitationEmail } from "../../src/lib/email-templates"

test("PROJ-10 builds a safe feedback invitation email", () => {
  const email = buildProjectFeedbackInvitationEmail({ recipientName: "عميل تجريبي", projectName: "مشروع أكوا", feedbackUrl: "https://example.com/feedback/token", validUntilLabel: "23 أغسطس 2026" })
  assert.match(email.subject, /مشروع أكوا/)
  assert.match(email.text, /https:\/\/example\.com\/feedback\/token/)
  assert.match(email.html, /إرسال التقييم/)
  assert.throws(() => buildProjectFeedbackInvitationEmail({ recipientName: "عميل", projectName: "مشروع", feedbackUrl: "javascript:alert(1)", validUntilLabel: "اليوم" }))
})

test("PROJ-10 records delivery lifecycle fields and constraints", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8")
  const migration = readFileSync("prisma/migrations/20260809220000_proj_10_feedback_invitation_delivery/migration.sql", "utf8")
  assert.match(schema, /deliveryAttemptCount\s+Int\s+@default\(0\)/)
  assert.match(migration, /ProjectFeedback_delivery_recipient_check/)
  assert.match(migration, /PROJECT_FEEDBACK_SENT/)
})

test("PROJ-10 prepares, sends, audits, and revokes failed links", () => {
  const route = readFileSync("src/app/api/projects/[id]/feedback/delivery/route.ts", "utf8")
  assert.match(route, /isolationLevel: "Serializable"/)
  assert.match(route, /sendProjectFeedbackInvitationEmail/)
  assert.match(route, /PROJECT_FEEDBACK_DELIVERY_PREPARED/)
  assert.match(route, /PROJECT_FEEDBACK_DELIVERY_FAILED/)
  assert.match(route, /publicTokenHash: null/)
})

test("PROJ-10 exposes explicit recipient and delivery controls", () => {
  const panel = readFileSync("src/app/dashboard/projects/[id]/ProjectFeedbackPanel.tsx", "utf8")
  assert.match(panel, /اسم المستلم/)
  assert.match(panel, /بريد المستلم/)
  assert.match(panel, /إرسال الدعوة/)
  assert.match(panel, /إصدار رابط لمدة 14 يومًا/)
})
