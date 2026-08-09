import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  FEEDBACK_REMINDER_BATCH_SIZE,
  FEEDBACK_REMINDER_COOLDOWN_MS,
  feedbackReminderScheduleSchema,
  nextFeedbackReminderAt,
} from "../../src/lib/project-feedback-reminder"

test("PROJ-12 validates explicit schedule opt-in and computes the governed due time", () => {
  assert.equal(feedbackReminderScheduleSchema.safeParse({ enabled: true }).success, true)
  assert.equal(feedbackReminderScheduleSchema.safeParse({ enabled: "true" }).success, false)
  const contact = new Date("2026-08-01T00:00:00.000Z")
  assert.equal(nextFeedbackReminderAt(contact, contact).getTime(), contact.getTime() + FEEDBACK_REMINDER_COOLDOWN_MS)
})

test("PROJ-12 protects the worker and limits each run", () => {
  const route = readFileSync("src/app/api/cron/feedback-reminders/route.ts", "utf8")
  assert.equal(FEEDBACK_REMINDER_BATCH_SIZE, 20)
  assert.match(route, /CRON_SECRET/)
  assert.match(route, /safeEqualSecrets/)
  assert.match(route, /take: FEEDBACK_REMINDER_BATCH_SIZE/)
})

test("PROJ-12 reuses the governed reminder sender and disables automatic retries on failure", () => {
  const worker = readFileSync("src/app/api/cron/feedback-reminders/route.ts", "utf8")
  const server = readFileSync("src/lib/project-feedback-reminder-server.ts", "utf8")
  assert.match(worker, /sendGovernedFeedbackReminder/)
  assert.match(worker, /source: "SCHEDULED"/)
  assert.match(server, /reminderScheduleEnabled: false, reminderNextAt: null/)
  assert.match(server, /scheduleStopped: source === "SCHEDULED"/)
})

test("PROJ-12 stops scheduling after receipt, revocation, provider failure, or the reminder cap", () => {
  const publicRoute = readFileSync("src/app/api/public/feedback/[token]/route.ts", "utf8")
  const linkRoute = readFileSync("src/app/api/projects/[id]/feedback/public-link/route.ts", "utf8")
  const server = readFileSync("src/lib/project-feedback-reminder-server.ts", "utf8")
  assert.match(publicRoute, /reminderScheduleEnabled: false/)
  assert.match(linkRoute, /reminderScheduleEnabled: false/)
  assert.match(server, /nextCount < FEEDBACK_REMINDER_MAX_COUNT/)
})
