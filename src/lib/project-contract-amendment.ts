import { z } from "zod"

export const PROJECT_CONTRACT_AMENDMENT_STATUSES = [
  "DRAFT",
  "READY_FOR_REVIEW",
  "INTERNALLY_APPROVED",
  "SENT",
  "ACCEPTED",
  "REJECTED",
] as const

export type ProjectContractAmendmentStatus =
  (typeof PROJECT_CONTRACT_AMENDMENT_STATUSES)[number]

export const projectContractAmendmentMutationSchema = z.discriminatedUnion(
  "action",
  [
    z.object({
      action: z.literal("CREATE"),
      internalNotes: z.string().trim().max(4000).optional().nullable(),
    }),
    z.object({ action: z.literal("READY_FOR_REVIEW") }),
    z.object({
      action: z.literal("INTERNALLY_APPROVE"),
      reference: z.string().trim().min(3).max(500),
    }),
    z.object({
      action: z.literal("MARK_SENT"),
      reference: z.string().trim().min(3).max(500),
    }),
    z.object({
      action: z.enum(["ACCEPT", "REJECT"]),
      reference: z.string().trim().min(3).max(500),
      notes: z.string().trim().max(4000).optional().nullable(),
    }),
  ],
)

export type ProjectContractAmendmentMutation = z.infer<
  typeof projectContractAmendmentMutationSchema
>

const allowedFrom: Record<
  Exclude<ProjectContractAmendmentMutation["action"], "CREATE">,
  readonly ProjectContractAmendmentStatus[]
> = {
  READY_FOR_REVIEW: ["DRAFT"],
  INTERNALLY_APPROVE: ["READY_FOR_REVIEW"],
  MARK_SENT: ["INTERNALLY_APPROVED"],
  ACCEPT: ["SENT"],
  REJECT: ["SENT"],
}

export function contractAmendmentActionIssues({
  status,
  action,
  creatorUserId,
  actor,
}: {
  status: ProjectContractAmendmentStatus
  action: Exclude<ProjectContractAmendmentMutation["action"], "CREATE">
  creatorUserId?: string | null
  actor: { id: string; role: string }
}) {
  const issues: string[] = []
  if (!allowedFrom[action].includes(status)) {
    issues.push(`لا يمكن تنفيذ ${action} من حالة ${status}`)
  }
  if (
    action === "INTERNALLY_APPROVE" &&
    actor.role !== "OWNER" &&
    creatorUserId === actor.id
  ) {
    issues.push("لا يمكن لمن أنشأ الملحق اعتماده داخليًا")
  }
  return issues
}
