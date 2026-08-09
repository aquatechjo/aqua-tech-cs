import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { buildProjectFeedbackReminderEmail } from "../../src/lib/email-templates"

test("PROJ-11 builds a safe reminder email", () => {
  const email = buildProjectFeedbackReminderEmail({ recipientName: "عميل", projectName: "مشروع", feedbackUrl: "https://example.com/feedback/token", validUntilLabel: "25 أغسطس 2026" })
  assert.match(email.subject, /تذكير/)
  assert.match(email.text, /https:\/\/example\.com/)
  assert.throws(() => buildProjectFeedbackReminderEmail({ recipientName: "عميل", projectName: "مشروع", feedbackUrl: "javascript:alert(1)", validUntilLabel: "اليوم" }))
})

test("PROJ-11 enforces cooldown and reminder cap", () => {
  const rules = readFileSync("src/lib/project-feedback-reminder.ts", "utf8")
  const server = readFileSync("src/lib/project-feedback-reminder-server.ts", "utf8")
  assert.match(rules, /72 \* 60 \* 60 \* 1000/)
  assert.match(rules, /FEEDBACK_REMINDER_MAX_COUNT = 3/)
  assert.match(server, /PROJECT_FEEDBACK_ALREADY_RECEIVED/)
})

test("PROJ-11 records reminder lifecycle", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8")
  const migration = readFileSync("prisma/migrations/20260810010000_proj_11_feedback_reminders/migration.sql", "utf8")
  assert.match(schema, /reminderCount\s+Int\s+@default\(0\)/)
  assert.match(schema, /reminderAttemptCount\s+Int\s+@default\(0\)/)
  assert.match(schema, /reminderPendingTokenHash\s+String\?\s+@unique/)
  assert.match(migration, /PROJECT_FEEDBACK_REMINDER_SENT/)
})

test("PROJ-11 rotates only after provider acceptance and preserves the active link on failure", () => {
  const server = readFileSync("src/lib/project-feedback-reminder-server.ts", "utf8")
  const sendIndex = server.indexOf("sendProjectFeedbackReminderEmail")
  const rotateIndex = server.indexOf("publicTokenHash: access.tokenHash", sendIndex)
  assert.ok(sendIndex >= 0 && rotateIndex > sendIndex)
  assert.match(server, /reminderPendingTokenHash: access\.tokenHash/)
  assert.match(server, /activeLinkPreserved: true/)
  assert.doesNotMatch(server, /x-feedback-token/)
  assert.match(server, /PROJECT_FEEDBACK_REMINDER_FAILED/)
})
