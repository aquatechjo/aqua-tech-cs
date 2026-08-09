import { z } from "zod"

export const FEEDBACK_REMINDER_COOLDOWN_MS = 72 * 60 * 60 * 1000
export const FEEDBACK_REMINDER_MAX_COUNT = 3
export const FEEDBACK_REMINDER_PREPARATION_TIMEOUT_MS = 15 * 60 * 1000
export const FEEDBACK_REMINDER_BATCH_SIZE = 20

export const feedbackReminderScheduleSchema = z.object({
  enabled: z.boolean(),
})

export function nextFeedbackReminderAt(lastContactAt: Date, now = new Date()) {
  const eligibleAt = new Date(lastContactAt.getTime() + FEEDBACK_REMINDER_COOLDOWN_MS)
  return eligibleAt > now ? eligibleAt : now
}
