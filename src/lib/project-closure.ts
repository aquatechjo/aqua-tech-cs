import { z } from "zod"

const evidence = {
  outcome: z.enum(["SUCCESS", "PARTIAL_SUCCESS", "CANCELLED"]),
  summary: z.string().trim().min(10).max(6000),
  lessonsLearned: z.string().trim().min(10).max(6000),
  followUpActions: z.string().trim().max(6000).optional().nullable(),
  clientHandoverRef: z.string().trim().min(3).max(1000),
  internalArchiveRef: z.string().trim().min(3).max(1000),
  exceptionReason: z.string().trim().max(4000).optional().nullable(),
}

export const projectClosureMutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("SAVE_DRAFT"), ...evidence }),
  z.object({ action: z.literal("SUBMIT"), ...evidence }),
  z.object({ action: z.literal("COMPLETE"), ...evidence }),
  z.object({ action: z.literal("ARCHIVE") }),
])

export type ProjectClosureBlockers = {
  incompleteDeliverables: number
  openChangeRequests: number
  openRisks: number
  openIssues: number
  incompleteTasks: number
}

export function closureBlockerCount(value: ProjectClosureBlockers) {
  return Object.values(value).reduce((sum, count) => sum + count, 0)
}

export function assertClosureTransition(status: string | null, action: string) {
  const allowed =
    action === "SAVE_DRAFT" ||
    (action === "SUBMIT" && (!status || status === "DRAFT")) ||
    (action === "COMPLETE" && status === "READY_FOR_REVIEW") ||
    (action === "ARCHIVE" && status === "COMPLETED")
  if (!allowed) throw new Error("PROJECT_CLOSURE_TRANSITION_NOT_ALLOWED")
}
