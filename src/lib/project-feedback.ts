import { z } from "zod"

const record = z.object({
  action: z.literal("RECORD"),
  npsScore: z.coerce.number().int().min(0).max(10),
  satisfactionScore: z.coerce.number().int().min(1).max(5),
  feedbackSummary: z.string().trim().min(10).max(6000),
  improvementNotes: z.string().trim().max(6000).optional().nullable(),
  testimonial: z.string().trim().max(3000).optional().nullable(),
  testimonialApproved: z.boolean().default(false),
  followUpRequired: z.boolean().default(false),
  followUpAction: z.string().trim().max(3000).optional().nullable(),
  followUpDueAt: z.string().datetime().optional().nullable(),
  ownerId: z.string().trim().optional().nullable(),
}).superRefine((value, context) => {
  if (value.testimonialApproved && !value.testimonial?.trim()) context.addIssue({ code: "custom", path: ["testimonial"], message: "نص الشهادة مطلوب قبل توثيق موافقة النشر" })
  const actionRequired = value.followUpRequired || value.npsScore <= 6 || value.satisfactionScore <= 2
  if (actionRequired && (!value.followUpAction?.trim() || !value.followUpDueAt || !value.ownerId)) context.addIssue({ code: "custom", path: ["followUpAction"], message: "إجراء المتابعة ومالكه وموعده مطلوبة عند انخفاض التقييم" })
})

export const projectFeedbackMutationSchema = z.union([
  record,
  z.object({ action: z.literal("RESOLVE"), resolutionNote: z.string().trim().min(10).max(3000) }),
  z.object({ action: z.literal("WAIVE"), resolutionNote: z.string().trim().min(10).max(3000) }),
])

export function feedbackStatus(input: { npsScore: number; satisfactionScore: number; followUpRequired: boolean }) {
  return input.followUpRequired || input.npsScore <= 6 || input.satisfactionScore <= 2 ? "ACTION_REQUIRED" as const : "RECEIVED" as const
}

export function feedbackTaskPriority(input: { npsScore: number; satisfactionScore: number }) {
  return input.npsScore <= 3 || input.satisfactionScore === 1 ? "URGENT" as const : "HIGH" as const
}

export function assertFeedbackTransition(status: string | null, action: string) {
  const allowed = action === "RECORD" || (action === "RESOLVE" && status === "ACTION_REQUIRED") || (action === "WAIVE" && (!status || ["PENDING", "RECEIVED", "ACTION_REQUIRED"].includes(status)))
  if (!allowed) throw new Error("PROJECT_FEEDBACK_TRANSITION_NOT_ALLOWED")
}
